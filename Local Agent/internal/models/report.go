package models

const TaskCommLen = 16 // Linux comm length

type Report struct {
	SystemId    string  `json:"SystemId"`
	Pid         uint32  `json:"Pid"`
	Process     string  `json:"Process"`
	AllocKB     int64   `json:"AllocKB"`
	FreeKB      int64   `json:"FreeKB"`
	Ratio       float64 `json:"Ratio"`
	LeakSuspect bool    `json:"LeakSuspect"`
	TimeStamp   int64   `json:"TimeStamp"`
}

type MemKey struct {
	Pid  uint32
	Comm [TaskCommLen]byte
}

type MemStats struct {
	AllocBytes uint64
	FreeBytes  uint64
}
