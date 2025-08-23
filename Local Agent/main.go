package main // Declares the package name

import (
	"encoding/json" // For JSON encoding/decoding
	"fmt"           // For formatted I/O
	"log"           // For logging errors/info
	"math"
	"os"        // For OS functions (files, signals)
	"os/signal" // For handling OS signals (e.g., Ctrl+C)
	"sort"      // For sorting slices
	"strings"   // For string manipulation
	"syscall"   // For syscall constants (e.g., SIGTERM)
	"time"      // For time-related functions

	"github.com/cilium/ebpf"      // For eBPF program/map handling
	"github.com/cilium/ebpf/link" // For attaching eBPF programs to tracepoints
)

const taskCommLen = 16 // Length of the process name (comm) in Linux

// memKey represents the key for the eBPF map: PID and process name
type memKey struct {
	Pid  uint32            // Process ID
	Comm [taskCommLen]byte // Process name (comm), fixed size
}

// memStats represents the value in the eBPF map: allocation and free stats
type memStats struct {
	AllocBytes uint64 // Total allocated bytes
	FreeBytes  uint64 // Total freed bytes
}

// leakReportEntry is the structure for JSON leak report entries
type leakReportEntry struct {
	PID         uint32  `json:"pid"`                 // Process ID
	ProcessName string  `json:"process_name"`        // Process name
	AllocKB     uint64  `json:"alloc_kb"`            // Allocated memory in KB
	FreeKB      uint64  `json:"free_kb"`             // Freed memory in KB
	Ratio       float64 `json:"alloc_to_free_ratio"` // Allocation to free ratio
	LeakSuspect bool    `json:"leak_suspect"`        // Whether this is a leak suspect
	Timestamp   string  `json:"timestamp"`           // Timestamp of the report
}

// commToString converts a [16]byte comm to a trimmed string
func commToString(c [taskCommLen]byte) string {
	s := string(c[:])                  // Convert byte array to string
	s = strings.TrimRight(s, "\x00\n") // Trim trailing nulls and newlines
	return s
}

func main() {
	objPath := "ram_monitor.o"                    // Path to the compiled eBPF object file
	spec, err := ebpf.LoadCollectionSpec(objPath) // Load eBPF program/map specs
	if err != nil {
		log.Fatalf("loading BPF spec %q: %v", objPath, err) // Exit on error
	}

	// Struct to hold loaded eBPF programs and map
	objs := struct {
		TraceAlloc *ebpf.Program `ebpf:"trace_alloc"` // Allocation tracepoint program
		TraceFree  *ebpf.Program `ebpf:"trace_free"`  // Free tracepoint program
		RamMap     *ebpf.Map     `ebpf:"ram_usage"`   // Map for RAM usage stats
	}{}

	if err := spec.LoadAndAssign(&objs, nil); err != nil { // Load and assign eBPF objects
		log.Fatalf("load and assign: %v", err) // Exit on error
	}
	defer objs.TraceAlloc.Close() // Clean up on exit
	defer objs.TraceFree.Close()
	defer objs.RamMap.Close()

	// Attach trace_alloc program to the "kmem:mm_page_alloc" tracepoint
	tpAlloc, err := link.Tracepoint("kmem", "mm_page_alloc", objs.TraceAlloc, nil)
	if err != nil {
		log.Fatalf("attach alloc tracepoint: %v", err) // Exit on error
	}
	defer tpAlloc.Close() // Clean up on exit

	// Attach trace_free program to the "kmem:mm_page_free" tracepoint
	tpFree, err := link.Tracepoint("kmem", "mm_page_free", objs.TraceFree, nil)
	if err != nil {
		log.Printf("warning: could not attach mm_page_free: %v", err) // Warn if not available
	} else {
		defer tpFree.Close() // Clean up if attached
	}

	log.Println("Monitoring RAM allocations (pid+comm -> alloc/free bytes)...") // Info message

	stop := make(chan os.Signal, 1)                    // Channel to receive OS signals
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM) // Listen for interrupt/terminate
	ticker := time.NewTicker(1 * time.Second)          // Ticker for periodic reporting
	defer ticker.Stop()                                // Clean up ticker

mainloop:
	for {
		select {
		case <-stop: // If interrupt signal received
			log.Println("received interrupt, exiting")
			break mainloop // Exit loop
		case <-ticker.C: // Every tick (2 seconds)
			if err := printLeakReport(objs.RamMap); err != nil { // Print leak report
				log.Printf("printLeakReport error: %v", err) // Log errors
			}
		}
	}
}

// printLeakReport reads the eBPF map, prints a report, and writes JSON
func printLeakReport(m *ebpf.Map) error {
	type entry struct {
		key   memKey
		stats memStats
	}

	var entries []entry
	var k memKey
	var v memStats

	it := m.Iterate()
	for it.Next(&k, &v) {
		keyCopy := k
		valCopy := v
		entries = append(entries, entry{key: keyCopy, stats: valCopy})
	}
	if err := it.Err(); err != nil {
		return fmt.Errorf("map iterate error: %w", err)
	}

	if len(entries) == 0 {
		fmt.Println("\n=== RAM Leak Report === (empty)")
		return nil
	}

	// Sort by allocated bytes desc
	sort.Slice(entries, func(i, j int) bool {
		return entries[i].stats.AllocBytes > entries[j].stats.AllocBytes
	})

	fmt.Println("\n=== RAM Leak Report ===")
	var jsonEntries []leakReportEntry

	for _, e := range entries {
		name := commToString(e.key.Comm)
		allocKB := e.stats.AllocBytes / 1024
		freeKB := e.stats.FreeBytes / 1024

		// compute ratio safely
		var ratio float64
		if e.stats.FreeBytes == 0 {
			// indicator that no frees observed — use a sentinel value (-1)
			ratio = -1.0
		} else {
			ratio = float64(e.stats.AllocBytes) / float64(e.stats.FreeBytes)
			// cap ratio to avoid absurd JSON numbers (optional visual safety)
			if math.IsInf(ratio, 0) || math.IsNaN(ratio) {
				ratio = -1.0
			} else if ratio > 1e6 {
				ratio = 1e6
			}
		}

		// Improved leak heuristic:
		// - If allocKB >= 1MB and ratio >= 1.2 => suspect
		// - OR if freeKB == 0 and allocKB >= 512KB => suspect (no frees observed)
		leakSuspect := false
		if allocKB >= 1024 && ratio >= 1.2 {
			leakSuspect = true
		} else if freeKB == 0 && allocKB >= 512 {
			leakSuspect = true
		}

		status := ""
		if leakSuspect {
			status = " [LEAK SUSPECT]"
		}

		// print friendly ratio for console
		printRatio := ""
		if ratio < 0 {
			printRatio = "N/A" // no frees observed
		} else {
			printRatio = fmt.Sprintf("%.2f", ratio)
		}

		fmt.Printf("PID: %-6d (%-20s) - Alloc: %8d KB | Freed: %8d KB | Ratio: %6s%s\n",
			e.key.Pid, truncate(name, 20), allocKB, freeKB, printRatio, status)

		// per-entry timestamp so each JSON entry is precise
		now := time.Now().Format(time.RFC3339)

		// For JSON, if ratio == -1 (no frees), serialize ratio as null-like sentinel:
		jsonRatio := ratio
		if ratio < 0 {
			// keep numeric but negative signals "no frees" — you can interpret this in consumer
			jsonRatio = -1.0
		}

		jsonEntries = append(jsonEntries, leakReportEntry{
			PID:         e.key.Pid,
			ProcessName: name,
			AllocKB:     allocKB,
			FreeKB:      freeKB,
			Ratio:       jsonRatio,
			LeakSuspect: leakSuspect,
			Timestamp:   now,
		})

		// delete key to clear counters for next tick (keeps your previous behavior)
		if err := m.Delete(&e.key); err != nil {
			// ignore races; optionally log unexpected errors
		}
	}

	// write JSON snapshot for this tick
	return writeLeakReportJSON(jsonEntries)
}

// writeLeakReportJSON writes the leak report to a JSON file
// replace writeLeakReportJSON with this (unchanged semantics, but kept here for completeness)
func writeLeakReportJSON(filename string, entries []entry) error {
	var existing []entry

	// Try to read existing file
	if data, err := os.ReadFile(filename); err == nil {
		if len(data) > 0 {
			if err := json.Unmarshal(data, &existing); err != nil {
				return fmt.Errorf("failed to unmarshal existing JSON: %w", err)
			}
		}
	}

	// Append new entries
	existing = append(existing, entries...)

	// Write updated array back to file
	data, err := json.MarshalIndent(existing, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal JSON: %w", err)
	}

	if err := os.WriteFile(filename, data, 0644); err != nil {
		return fmt.Errorf("failed to write JSON file: %w", err)
	}

	return nil
}

// truncate shortens a string to n characters, adding "..." if needed
func truncate(s string, n int) string {
	if len(s) <= n {
		return s // No need to truncate
	}
	if n <= 3 {
		return s[:n] // Not enough space for "..."
	}
	return s[:n-3] + "..." // Truncate and add ellipsis
}

// max returns the maximum of two uint64 numbers
func max(a, b uint64) uint64 {
	if a > b {
		return a
	}
	return b
}
