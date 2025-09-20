package main

import (
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"fyp/internal/ebpf"
	"fyp/internal/netclient"
	"fyp/internal/reporter"
)

func main() {
	// Load eBPF programs
	objs, tpAlloc, tpFree := ebpf.Load()
	defer objs.TraceAlloc.Close()
	defer objs.TraceFree.Close()
	defer objs.RamMap.Close()
	defer tpAlloc.Close()
	if tpFree != nil {
		defer tpFree.Close()
	}

	// Connect to server
	conn := netclient.Connect("localhost:8080")
	defer conn.Close()

	log.Println("Monitoring RAM allocations...")

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()

mainloop:
	for {
		select {
		case <-stop:
			log.Println("received interrupt, exiting")
			break mainloop
		case <-ticker.C:
			if err := reporter.PrintLeakReport(objs.RamMap, conn); err != nil {
				log.Printf("printLeakReport error: %v", err)
			}
		}
	}
}
