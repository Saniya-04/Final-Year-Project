package server

import (
	"fmt"
	"net"

	"eBPF_Server/internal/handlers"
	"eBPF_Server/internal/models"
)

func acceptLoop(listener *net.TCPListener, reportChan chan<- models.Report) {
	for {
		conn, err := listener.Accept()
		if err != nil {
			fmt.Println("accepting connection failed:", err)
			continue
		}
		go handlers.HandleConnection(conn, reportChan)
		fmt.Println("connection accepted from", conn.RemoteAddr())
	}
}

func StartServer(reportChan chan<- models.Report) error {
	port := ":8080"

	addr, err := net.ResolveTCPAddr("tcp4", port)
	if err != nil {
		return fmt.Errorf("unable to resolve tcp: %w", err)
	}

	listener, err := net.ListenTCP("tcp4", addr)
	if err != nil {
		return fmt.Errorf("unable to start server: %w", err)
	}

	acceptLoop(listener, reportChan)
	return nil
}
