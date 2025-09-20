package main

import (
	"bytes"
	_ "embed"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"net"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/cilium/ebpf"
	"github.com/cilium/ebpf/link"
	"github.com/cilium/ebpf/rlimit"
)

const taskCommLen = 16 // Length of the process name (comm) in Linux

type Report struct {
	SystemId    string  `json:"SystemId"`
	Pid         uint32  `json:"Pid"`
	Process     string  `json:"Process"`
	AllocKB     int64   `json:"AllocKB"`
	FreeKB      int64   `json:"FreeKB"`
	Ratio       float64 `json:"Ratio"`
	LeakSuspect bool    `json:"LeakSuspect"`
	TimeStamp   int64   `json:"TimeStamp"`
}

// memKey represents the key for the eBPF map: PID and process name
type memKey struct {
	Pid  uint32
	Comm [taskCommLen]byte
}

// memStats represents the value in the eBPF map: allocation and free stats
type memStats struct {
	AllocBytes uint64
	FreeBytes  uint64
}

// commToString converts a [16]byte comm to a trimmed string
func commToString(c [taskCommLen]byte) string {
	s := string(c[:])
	s = strings.TrimRight(s, "\x00\n")
	return s
}

//go:embed ram_monitor.o
var bpfObj []byte

func main() {

	var conn net.Conn
	var err error

	for {
		conn, err = net.Dial("tcp", "localhost:8080")
		if err != nil {
			log.Printf("server disconnected, retrying...")
			if conn != nil {
				conn.Close()
			}
			for {
				conn, err = net.Dial("tcp", "localhost:8080")
				if err != nil {
					log.Printf("server disconnected, retrying in 5s: %v", err)
					time.Sleep(5 * time.Second)
					continue
				}
				log.Println("Connected to server")
				break
			}
		}

		spec, err := ebpf.LoadCollectionSpecFromReader(bytes.NewReader(bpfObj))

		if err != nil {
			log.Fatalf("loading BPF spec: %v", err)
		}

		objs := struct {
			TraceAlloc *ebpf.Program `ebpf:"trace_alloc"`
			TraceFree  *ebpf.Program `ebpf:"trace_free"`
			RamMap     *ebpf.Map     `ebpf:"ram_usage"`
		}{}

		if err := rlimit.RemoveMemlock(); err != nil {
			log.Fatalf("failed to remove memlock limit: %v", err)
		}

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
		ticker := time.NewTicker(10 * time.Second)
		defer ticker.Stop()

	mainloop:
		for {
			select {
			case <-stop:
				log.Println("received interrupt, exiting")
				break mainloop
			case <-ticker.C:
				if err := printLeakReport(objs.RamMap, conn); err != nil {
					log.Printf("printLeakReport error: %v", err)
				}
			}
		}
	}
}

func printLeakReport(m *ebpf.Map, conn net.Conn) error {
	type entry struct {
		key   memKey
		stats memStats
	}

	var entries []entry
	var k memKey
	var v memStats
	var reports []Report

	it := m.Iterate()
	for it.Next(&k, &v) {
		keyCopy := k
		valCopy := v
		entries = append(entries, entry{key: keyCopy, stats: valCopy})
	}
	if err := it.Err(); err != nil {
		return fmt.Errorf("map iterate error: %w", err)
	}

	hostname, _ := os.Hostname()

	// 🔹 If no entries, send heartbeat
	if len(entries) == 0 {
		heartbeat := Report{
			SystemId:  hostname,
			TimeStamp: time.Now().Unix(),
		}
		data, _ := json.Marshal([]Report{heartbeat})
		_, err := conn.Write(append(data, '\n'))
		if err != nil {
			log.Printf("failed to send heartbeat: %v", err)
		} else {
			log.Printf("sent heartbeat for %s", hostname)
		}
		return nil
	}

	// 🔹 Otherwise, build normal reports
	for _, e := range entries {
		name := commToString(e.key.Comm)
		allocKB := e.stats.AllocBytes / 1024
		freeKB := e.stats.FreeBytes / 1024

		var ratio float64
		if e.stats.FreeBytes == 0 {
			ratio = -1.0
		} else {
			ratio = float64(e.stats.AllocBytes) / float64(e.stats.FreeBytes)
			if math.IsInf(ratio, 0) || math.IsNaN(ratio) {
				ratio = -1.0
			} else if ratio > 1e6 {
				ratio = 1e6
			}
		}

		leakSuspect := false
		if allocKB >= 1024 && ratio >= 1.2 {
			leakSuspect = true
		} else if freeKB == 0 && allocKB >= 512 {
			leakSuspect = true
		}

		report := Report{
			SystemId:    hostname,
			Pid:         e.key.Pid,
			Process:     name,
			AllocKB:     int64(allocKB),
			FreeKB:      int64(freeKB),
			Ratio:       ratio,
			LeakSuspect: leakSuspect,
			TimeStamp:   time.Now().Unix(),
		}
		reports = append(reports, report)

		// 🔹 Optional cleanup to avoid map growing forever
		if err := m.Delete(&e.key); err != nil {
			log.Printf("map delete failed for PID %d: %v", e.key.Pid, err)
		}
	}

	data, err := json.Marshal(reports)
	if err != nil {
		log.Printf("json marshal error: %v", err)
	}

	_, err = conn.Write(append(data, '\n'))
	if err != nil {
		log.Printf("failed to send report: %v", err)
	} else if len(reports) > 0 {
		log.Printf("sent %d reports for %s", len(reports), hostname)
	}
	return nil
}
package main

import (
	"fmt"
	"log"
	"math"
	"os"
	"os/signal"
	"sort"
	"strings"
	"syscall"
	"time"

	"github.com/cilium/ebpf"
	"github.com/cilium/ebpf/link"
)

const taskCommLen = 16 // Length of the process name (comm) in Linux

// memKey represents the key for the eBPF map: PID and process name
type memKey struct {
	Pid  uint32
	Comm [taskCommLen]byte
}

// memStats represents the value in the eBPF map: allocation and free stats
type memStats struct {
	AllocBytes uint64
	FreeBytes  uint64
}

// commToString converts a [16]byte comm to a trimmed string
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
	ticker := time.NewTicker(1 * time.Second)
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

		var ratio float64
		if e.stats.FreeBytes == 0 {
			ratio = -1.0
		} else {
			ratio = float64(e.stats.AllocBytes) / float64(e.stats.FreeBytes)
			if math.IsInf(ratio, 0) || math.IsNaN(ratio) {
				ratio = -1.0
			} else if ratio > 1e6 {
				ratio = 1e6
			}
		}

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

		printRatio := ""
		if ratio < 0 {
			printRatio = "N/A"
		} else {
			printRatio = fmt.Sprintf("%.2f", ratio)
		}

		fmt.Printf("PID: %-6d (%-20s) - Alloc: %8d KB | Freed: %8d KB | Ratio: %6s%s\n",
			e.key.Pid, truncate(name, 20), allocKB, freeKB, printRatio, status)

		if err := m.Delete(&e.key); err != nil {
			// optionally log
		}
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
