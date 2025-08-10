package main // Declares the package name

import (
	"encoding/json"    // For JSON encoding/decoding
	"fmt"              // For formatted I/O
	"log"              // For logging errors/info
	"os"               // For OS functions (files, signals)
	"os/signal"        // For handling OS signals (e.g., Ctrl+C)
	"sort"             // For sorting slices
	"strings"          // For string manipulation
	"syscall"          // For syscall constants (e.g., SIGTERM)
	"time"             // For time-related functions

	"github.com/cilium/ebpf"    // For eBPF program/map handling
	"github.com/cilium/ebpf/link" // For attaching eBPF programs to tracepoints
)

const taskCommLen = 16 // Length of the process name (comm) in Linux

// memKey represents the key for the eBPF map: PID and process name
type memKey struct {
	Pid  uint32           // Process ID
	Comm [taskCommLen]byte // Process name (comm), fixed size
}

// memStats represents the value in the eBPF map: allocation and free stats
type memStats struct {
	AllocBytes uint64 // Total allocated bytes
	FreeBytes  uint64 // Total freed bytes
}

// leakReportEntry is the structure for JSON leak report entries
type leakReportEntry struct {
	PID         uint32  `json:"pid"`              // Process ID
	ProcessName string  `json:"process_name"`     // Process name
	AllocKB     uint64  `json:"alloc_kb"`         // Allocated memory in KB
	FreeKB      uint64  `json:"free_kb"`          // Freed memory in KB
	Ratio       float64 `json:"alloc_to_free_ratio"` // Allocation to free ratio
	LeakSuspect bool    `json:"leak_suspect"`     // Whether this is a leak suspect
	Timestamp   string  `json:"timestamp"`        // Timestamp of the report
}

// commToString converts a [16]byte comm to a trimmed string
func commToString(c [taskCommLen]byte) string {
	s := string(c[:])                  // Convert byte array to string
	s = strings.TrimRight(s, "\x00\n") // Trim trailing nulls and newlines
	return s
}

func main() {
	objPath := "ram_monitor.o" // Path to the compiled eBPF object file
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

	stop := make(chan os.Signal, 1) // Channel to receive OS signals
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM) // Listen for interrupt/terminate
	ticker := time.NewTicker(2 * time.Second) // Ticker for periodic reporting
	defer ticker.Stop() // Clean up ticker

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
		key   memKey   // Map key (PID+comm)
		stats memStats // Map value (alloc/free stats)
	}

	var entries []entry // Slice to hold all entries
	var k memKey        // Temp key for iteration
	var v memStats      // Temp value for iteration

	it := m.Iterate() // Get map iterator
	for it.Next(&k, &v) { // Iterate over all map entries
		keyCopy := k   // Copy key (avoid pointer reuse)
		valCopy := v   // Copy value
		entries = append(entries, entry{key: keyCopy, stats: valCopy}) // Add to slice
	}
	if err := it.Err(); err != nil { // Check for iteration errors
		return fmt.Errorf("map iterate error: %w", err)
	}

	if len(entries) == 0 { // If map is empty
		fmt.Println("\n=== RAM Leak Report === (empty)")
		return nil
	}

	// Sort entries by allocated bytes, descending
	sort.Slice(entries, func(i, j int) bool {
		return entries[i].stats.AllocBytes > entries[j].stats.AllocBytes
	})

	fmt.Println("\n=== RAM Leak Report ===") // Print header
	var jsonEntries []leakReportEntry // Slice for JSON output
	now := time.Now().Format(time.RFC3339) // Current timestamp

	for _, e := range entries { // For each entry
		name := commToString(e.key.Comm) // Convert comm to string
		allocKB := e.stats.AllocBytes / 1024 // Allocated KB
		freeKB := e.stats.FreeBytes / 1024   // Freed KB

		ratio := float64(e.stats.AllocBytes) / float64(max(e.stats.FreeBytes, 1)) // Alloc/free ratio
		leakSuspect := ratio > 1.2 && allocKB > 1024 // Heuristic: suspect if ratio high and alloc > 1MB

		status := ""
		if leakSuspect {
			status = " [LEAK SUSPECT]" // Mark as suspect
		}

		// Print entry to console
		fmt.Printf("PID: %-6d (%-20s) - Alloc: %8d KB | Freed: %8d KB | Ratio: %.2f%s\n",
			e.key.Pid, truncate(name, 20), allocKB, freeKB, ratio, status)

		// Add entry to JSON slice
		jsonEntries = append(jsonEntries, leakReportEntry{
			PID:         e.key.Pid,
			ProcessName: name,
			AllocKB:     allocKB,
			FreeKB:      freeKB,
			Ratio:       ratio,
			LeakSuspect: leakSuspect,
			Timestamp:   now,
		})

		m.Delete(&e.key) // Optionally clear map for next tick
	}

	return writeLeakReportJSON(jsonEntries) // Write JSON file
}

// writeLeakReportJSON writes the leak report to a JSON file
func writeLeakReportJSON(data []leakReportEntry) error {
	file, err := os.OpenFile("leak_report.json", os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0644) // Open file for writing
	if err != nil {
		return fmt.Errorf("opening JSON file: %w", err) // Return error if failed
	}
	defer file.Close() // Close file on exit

	encoder := json.NewEncoder(file) // Create JSON encoder
	encoder.SetIndent("", "  ")      // Pretty-print JSON

	if err := encoder.Encode(data); err != nil { // Encode data to file
		return fmt.Errorf("encoding JSON: %w", err) // Return error if failed
	}

	return nil // Success
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
