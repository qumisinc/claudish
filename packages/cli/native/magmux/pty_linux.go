package main

import (
	"fmt"
	"os"
	"strconv"
	"syscall"
	"unsafe"

	"golang.org/x/sys/unix"
)

func openPTY() (master *os.File, slave *os.File, err error) {
	master, err = os.OpenFile("/dev/ptmx", os.O_RDWR, 0)
	if err != nil {
		return nil, nil, fmt.Errorf("open /dev/ptmx: %w", err)
	}
	fd := int(master.Fd())

	// unlockpt via ioctl TIOCSPTLCK
	var unlock int
	if _, _, errno := syscall.Syscall(syscall.SYS_IOCTL, uintptr(fd),
		syscall.TIOCSPTLCK, uintptr(unsafe.Pointer(&unlock))); errno != 0 {
		master.Close()
		return nil, nil, fmt.Errorf("unlockpt: %w", errno)
	}

	// ptsname via ioctl TIOCGPTN
	var ptsNum uint32
	if _, _, errno := syscall.Syscall(syscall.SYS_IOCTL, uintptr(fd),
		syscall.TIOCGPTN, uintptr(unsafe.Pointer(&ptsNum))); errno != 0 {
		master.Close()
		return nil, nil, fmt.Errorf("ptsname: %w", errno)
	}
	slaveName := "/dev/pts/" + strconv.Itoa(int(ptsNum))

	slave, err = os.OpenFile(slaveName, os.O_RDWR|syscall.O_NOCTTY, 0)
	if err != nil {
		master.Close()
		return nil, nil, fmt.Errorf("open slave %s: %w", slaveName, err)
	}

	return master, slave, nil
}

func sleepMs(ms int) {
	var tv unix.Timeval
	tv.Sec = int64(ms / 1000)
	tv.Usec = int64((ms % 1000) * 1000)
	unix.Select(0, nil, nil, nil, &tv)
}
