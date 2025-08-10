package main

import (
	"fmt"
	"log"
	"os"
	"os/signal"
	"sort"
	"strings"
	"syscall"
	"time"

	"github.com/cilium/ebpf"
	"github.com/cilium/ebpf/link"
)

const taskCommLen = 16

type memKey struct {
	Pid  uint32
	Comm [taskCommLen]byte
}

type memStats struct {
	AllocBytes uint64
	FreeBytes  uint64
}

func commToString(c [taskCommLen]byte) string {
	s := string(c[:])
	s = strings.TrimRight(s, "\x00\n")
	return s
}

func main() {
	objPath := "ram_monitor.o"
	spec, err := ebpf.LoadCollectionSpec(objPath)
	if err != nil {
		log.Fatalf("loading BPF spec %q: %v", objPath, err)
	}

	objs := struct {
		TraceAlloc *ebpf.Program `ebpf:"trace_alloc"`
		TraceFree  *ebpf.Program `ebpf:"trace_free"`
		RamMap     *ebpf.Map     `ebpf:"ram_usage"`
	}{}

	if err := spec.LoadAndAssign(&objs, nil); err != nil {
		log.Fatalf("load and assign: %v", err)
	}
	defer objs.TraceAlloc.Close()
	defer objs.TraceFree.Close()
	defer objs.RamMap.Close()

	tpAlloc, err := link.Tracepoint("kmem", "mm_page_alloc", objs.TraceAlloc, nil)
	if err != nil {
		log.Fatalf("attach alloc tracepoint: %v", err)
	}
	defer tpAlloc.Close()

	tpFree, err := link.Tracepoint("kmem", "mm_page_free", objs.TraceFree, nil)
	if err != nil {
		log.Printf("warning: could not attach mm_page_free: %v", err)
	} else {
		defer tpFree.Close()
	}

	log.Println("Monitoring RAM allocations (pid+comm -> alloc/free bytes)...")

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()

mainloop:
	for {
		select {
		case <-stop:
			log.Println("received interrupt, exiting")
			break mainloop
		case <-ticker.C:
			if err := printLeakReport(objs.RamMap); err != nil {
				log.Printf("printLeakReport error: %v", err)
			}
		}
	}
}

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

	sort.Slice(entries, func(i, j int) bool {
		return entries[i].stats.AllocBytes > entries[j].stats.AllocBytes
	})

	fmt.Println("\n=== RAM Leak Report ===")
	for _, e := range entries {
		name := commToString(e.key.Comm)
		allocKB := e.stats.AllocBytes / 1024
		freeKB := e.stats.FreeBytes / 1024

		ratio := float64(e.stats.AllocBytes) / float64(max(e.stats.FreeBytes, 1))
		leakSuspect := ratio > 1.2 && allocKB > 1024 // >1MB alloc and 20% more alloc than free

		status := ""
		if leakSuspect {
			status = " [LEAK SUSPECT]"
		}

		fmt.Printf("PID: %-6d (%-20s) - Alloc: %8d KB | Freed: %8d KB | Ratio: %.2f%s\n",
			e.key.Pid, truncate(name, 20), allocKB, freeKB, ratio, status)

		m.Delete(&e.key) // optional: clear map for next tick
	}

	return nil
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	if n <= 3 {
		return s[:n]
	}
	return s[:n-3] + "..."
}

func max(a, b uint64) uint64 {
	if a > b {
		return a
	}
	return b
}
