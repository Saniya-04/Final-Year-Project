package ebpf

import (
	"bytes"
	_ "embed"
	"log"

	"github.com/cilium/ebpf"
	"github.com/cilium/ebpf/link"
	"github.com/cilium/ebpf/rlimit"
)

//go:embed ram_monitor.o
var bpfObj []byte

type Objects struct {
	TraceAlloc *ebpf.Program `ebpf:"trace_alloc"`
	TraceFree  *ebpf.Program `ebpf:"trace_free"`
	RamMap     *ebpf.Map     `ebpf:"ram_usage"`
}

func Load() (*Objects, link.Link, link.Link) {
	if err := rlimit.RemoveMemlock(); err != nil {
		log.Fatalf("failed to remove memlock: %v", err)
	}

	spec, err := ebpf.LoadCollectionSpecFromReader(bytes.NewReader(bpfObj))
	if err != nil {
		log.Fatalf("loading BPF spec: %v", err)
	}

	objs := &Objects{}
	if err := spec.LoadAndAssign(objs, nil); err != nil {
		log.Fatalf("load and assign: %v", err)
	}

	tpAlloc, err := link.Tracepoint("kmem", "mm_page_alloc", objs.TraceAlloc, nil)
	if err != nil {
		log.Fatalf("attach alloc tracepoint: %v", err)
	}

	tpFree, err := link.Tracepoint("kmem", "mm_page_free", objs.TraceFree, nil)
	if err != nil {
		log.Printf("warning: could not attach mm_page_free: %v", err)
	}

	return objs, tpAlloc, tpFree
}
