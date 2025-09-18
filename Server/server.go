package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"log"
	"net"
	"time"
)

type Report struct {
	SystemId    string
	Pid         uint32
	Process     string
	AllocKB     uint64
	FreeKB      uint64
	Ratio       float64
	LeakSuspect bool
	TimeStamp   int64
}

var reportChan = make(chan Report, 1024) // buffered to avoid blocking

// Handle the connected peers
func handleConnection(conn net.Conn) {
	defer conn.Close()

	scanner := bufio.NewScanner(conn)

	for scanner.Scan() {
		line := scanner.Text()
		var r Report
		if err := json.Unmarshal([]byte(line), &r); err != nil {
			log.Printf("invalid JSON from %s: %v", conn.RemoteAddr(), err)
			continue
		}
		if r.TimeStamp == 0 {
			r.TimeStamp = time.Now().Unix()
		}
		reportChan <- r
	}
	if err := scanner.Err(); err != nil {
		log.Printf("error reading from %s: %v", conn.RemoteAddr(), err)
	}
}

func consumeReports() {
	for r := range reportChan {
		fmt.Printf("Report from %s | PID: %d | Process: %s | Alloc: %dKB | Free: %dKB | Leak: %v\n",
			r.SystemId, r.Pid, r.Process, r.AllocKB, r.FreeKB, r.LeakSuspect)
		// TODO: send to Firebase here
	}
}

// Accept the incomming connections
func acceptLoop(listener *net.TCPListener) {
	for {
		conn, err := listener.Accept()
		if err != nil {
			fmt.Println("accepting connection failed:", err)
			continue
		}
		go handleConnection(conn)
		fmt.Println("connection accepted from", conn.RemoteAddr())
	}
}

// Start a TCP server
func startServer() error {

	port := ":8080"

	addr, err := net.ResolveTCPAddr("tcp4", port)
	if err != nil {
		return fmt.Errorf("unable to resolve tcp: %w", err)
	}

	listener, err := net.ListenTCP("tcp4", addr)
	if err != nil {
		return fmt.Errorf("unable to start server: %w", err)
	}

	acceptLoop(listener)

	return nil
}

// Main function
func main() {
	go consumeReports()

	if err := startServer(); err != nil {
		fmt.Println("Server error:", err)
		return
	}
	select {}
}
