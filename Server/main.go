package main

import (
	"fmt"

	"eBPF_Server/internal/firebase"
	"eBPF_Server/internal/models"
	"eBPF_Server/internal/server"
)

func main() {
	reportChan := make(chan models.Report, 1024)

	firebase.InitFirebase()
	go firebase.ConsumeReports(reportChan)

	if err := server.StartServer(reportChan); err != nil {
		fmt.Println("Server error:", err)
		return
	}
	select {}
}
