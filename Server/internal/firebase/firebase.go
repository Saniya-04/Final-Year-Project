package firebase

import (
	"context"
	"fmt"
	"log"

	firebase "firebase.google.com/go"
	"google.golang.org/api/option"

	"eBPF_Server/internal/models"
)

var fbClient *firebase.App

func InitFirebase() {
	opt := option.WithCredentialsFile("serviceAccountKey.json")

	app, err := firebase.NewApp(context.Background(), nil, opt)
	if err != nil {
		log.Fatalf("error initializing firebase: %v", err)
	}
	fbClient = app
}

func ConsumeReports(reportChan <-chan models.Report) {
	ctx := context.Background()
	client, err := fbClient.Firestore(ctx)
	if err != nil {
		log.Fatalf("firestore client error: %v", err)
	}
	defer client.Close()

	for r := range reportChan {
		// ✅ Use a custom unique document ID: timestamp-systemId-pid
		docID := fmt.Sprintf("%d-%s-%d", r.TimeStamp, r.SystemId, r.Pid)

		_, err := client.Collection("systems").
			Doc(r.SystemId).
			Collection("reports").
			Doc(docID).
			Set(ctx, r)
		if err != nil {
			log.Printf("failed to write report: %v", err)
			continue
		}

		// ✅ Keep latest snapshot overwrite
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
