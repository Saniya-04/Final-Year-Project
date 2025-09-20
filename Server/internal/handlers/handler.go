package handlers

import (
	"bufio"
	"eBPF_Server/internal/models"
	"encoding/json"
	"log"
	"net"
	"time"
)

func HandleConnection(conn net.Conn, reportChan chan<- models.Report) {
	defer conn.Close()

	scanner := bufio.NewScanner(conn)
	for scanner.Scan() {
		line := scanner.Text()

		var reports []models.Report
		if err := json.Unmarshal([]byte(line), &reports); err != nil {
			var r models.Report
			if err2 := json.Unmarshal([]byte(line), &r); err2 != nil {
				log.Printf("invalid JSON from %s: %v", conn.RemoteAddr(), err)
				continue
			}
			if r.TimeStamp == 0 {
				r.TimeStamp = time.Now().Unix()
			}
			reports = append(reports, r)
		}

		for _, r := range reports {
			if r.TimeStamp == 0 {
				r.TimeStamp = time.Now().Unix()
			}
			reportChan <- r
		}
	}

	if err := scanner.Err(); err != nil {
		log.Printf("error reading from %s: %v", conn.RemoteAddr(), err)
	}
}
