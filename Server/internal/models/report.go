package models

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
