package netclient

import (
	"log"
	"net"
	"time"
)

func Connect(addr string) net.Conn {
	var conn net.Conn
	var err error

	for {
		conn, err = net.Dial("tcp", addr)
		if err != nil {
			log.Printf("server disconnected, retrying in 5s: %v", err)
			time.Sleep(5 * time.Second)
			continue
		}
		log.Println("Connected to server")
		return conn
	}
}
