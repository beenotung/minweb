#!/bin/bash
target="$1"
if [ "$target" == "" ]; then
  if [ -f .last ]; then
    target=$(cat .last);
  else
    echo -n "target: "; read target;
  fi
fi
if [ ! -f "$target" ]; then
  echo "Error: file not exist: $target";
  exit 1;
fi
echo "$target" > .last
cat "$target" | xclip -sel clipboard
date
echo 'done'
