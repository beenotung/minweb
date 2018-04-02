#!/bin/bash
set -e
ts-node test/parser-test.ts > in.html 2> out.html
