package reporter

import (
	"encoding/json"
	"fmt"
	"log"
	"math"
	"net"
	"os"
	"strings"
	"time"

	"github.com/cilium/ebpf"

	"fyp/internal/models"
)

func commToString(c [models.TaskCommLen]byte) string {
	s := string(c[:])
	return strings.TrimRight(s, "\x00\n")
}

func PrintLeakReport(m *ebpf.Map, conn net.Conn) error {
	var k models.MemKey
	var v models.MemStats
	var reports []models.Report

	it := m.Iterate()
	for it.Next(&k, &v) {
		allocKB := v.AllocBytes / 1024
		freeKB := v.FreeBytes / 1024

		var ratio float64
		if v.FreeBytes == 0 {
			ratio = -1.0
		} else {
			ratio = float64(v.AllocBytes) / float64(v.FreeBytes)
			if math.IsInf(ratio, 0) || math.IsNaN(ratio) {
				ratio = -1.0
			} else if ratio > 1e6 {
				ratio = 1e6
			}
		}

		leakSuspect := (allocKB >= 1024 && ratio >= 1.2) || (freeKB == 0 && allocKB >= 512)

		hostname, _ := os.Hostname()
		reports = append(reports, models.Report{
			SystemId:    hostname,
			Pid:         k.Pid,
			Process:     commToString(k.Comm),
			AllocKB:     int64(allocKB),
			FreeKB:      int64(freeKB),
			Ratio:       ratio,
			LeakSuspect: leakSuspect,
			TimeStamp:   time.Now().Unix(),
		})

		// Cleanup
		if err := m.Delete(&k); err != nil {
			log.Printf("map delete failed for PID %d: %v", k.Pid, err)
		}
	}

	if len(reports) == 0 {
		// Send heartbeat
		hostname, _ := os.Hostname()
		hb := models.Report{SystemId: hostname, TimeStamp: time.Now().Unix()}
		reports = append(reports, hb)
	}

	data, err := json.Marshal(reports)
	if err != nil {
		return fmt.Errorf("json marshal error: %v", err)
	}

	_, err = conn.Write(append(data, '\n'))
	if err != nil {
		log.Printf("failed to send report: %v", err)
	}
	return nil
}
