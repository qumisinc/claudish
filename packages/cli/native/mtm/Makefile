CC ?= cc
CFLAGS ?= -O2 -Wall -Wextra -std=c99
FEATURES ?= -D_POSIX_C_SOURCE=200809L -D_XOPEN_SOURCE=600 -D_XOPEN_SOURCE_EXTENDED

# Detect macOS vs Linux
UNAME := $(shell uname)
ifeq ($(UNAME), Darwin)
    FEATURES += -DWCHAR_IS_UNICODE
    LDFLAGS = -lncurses -lutil
else
    LDFLAGS = -lncursesw -lutil
endif

all: mtm

config.h: config.def.h
	cp config.def.h config.h

mtm: vtparser.c mtm.c pair.c config.h
	$(CC) $(CFLAGS) $(FEATURES) -o mtm vtparser.c mtm.c pair.c $(LDFLAGS)

clean:
	rm -f mtm config.h
