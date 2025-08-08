package main

import (
	"fmt"
	"log"
	"time"

	"github.com/cilium/ebpf"
	"github.com/cilium/ebpf/link"
)

func main() {
	spec, err := ebpf.LoadCollectionSpec("ram_monitor.o")
	if err != nil {
		log.Fatalf("loading BPF spec: %v", err)
	}

	coll, err := ebpf.NewCollection(spec)
	if err != nil {
		log.Fatalf("creating BPF collection: %v", err)
	}
	defer coll.Close()

	prog := coll.Programs["trace_mem_alloc"]
	if prog == nil {
		log.Fatalf("program not found")
	}

	tp, err := link.Tracepoint("kmem", "mm_page_alloc", prog, nil)
	if err != nil {
		log.Fatalf("attaching tracepoint: %v", err)
	}
	defer tp.Close()

	memMap := coll.Maps["mem_events"]
	if memMap == nil {
		log.Fatalf("map not found")
	}

	key := uint32(0)
	fmt.Println("Monitoring RAM allocations (via kmem:mm_page_alloc)...")
	for {
		var val uint64
		if err := memMap.Lookup(&key, &val); err == nil {
			fmt.Printf("Page alloc order sum: %d (each order ~4KB * 2^order)\n", val)
		}
		time.Sleep(2 * time.Second)
	}
}
