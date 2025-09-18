package main

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net"
	"time"

	firebase "firebase.google.com/go"
	"google.golang.org/api/option"
)

type Report struct {
	SystemId    string
	Pid         uint32
	Process     string
	AllocKB     int64
	FreeKB      int64
	Ratio       float64
	LeakSuspect bool
	TimeStamp   int64
}

var reportChan = make(chan Report, 1024) // buffered to avoid blocking
var fbClient *firebase.App

func initFirebase() {
	opt := option.WithCredentialsFile("serviceAccountKey.json")

	app, err := firebase.NewApp(context.Background(), nil, opt)
	if err != nil {
		log.Fatalf("error initializing firebase: %v", err)
	}
	fbClient = app
}

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

// {"SystemId":"sys-241","Pid":1234,"Process":"code","AllocKB":1542,"FreeKB":456,"Ratio":4.0,"LeakSuspect":false,"TimeStamp":1695023452}

func consumeReports() {
	ctx := context.Background()
	client, err := fbClient.Firestore(ctx)
	if err != nil {
		log.Fatalf("firestore client error: %v", err)
	}
	defer client.Close()

	for r := range reportChan {
		// Path: systems/{systemId}/reports/{timestamp}
		_, err := client.Collection("systems").
			Doc(r.SystemId).
			Collection("reports").
			Doc(fmt.Sprintf("%d", r.TimeStamp)).
			Set(ctx, r)
		if err != nil {
			log.Printf("failed to write report: %v", err)
			continue
		}

		// Optional: store latest snapshot
		_, err = client.Collection("systems").
			Doc(r.SystemId).
			Collection("latest").
			Doc("snapshot").
			Set(ctx, r)
		if err != nil {
			log.Printf("failed to write latest snapshot: %v", err)
		}

		fmt.Printf("✅ Wrote report for %s (PID %d)\n", r.SystemId, r.Pid)
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
	initFirebase()
	go consumeReports()

	if err := startServer(); err != nil {
		fmt.Println("Server error:", err)
		return
	}
	select {}
}
