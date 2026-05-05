import sys

duration = 30
start = 10
end = 20
print(f"ffmpeg -ss {start} -i input.mp4 -t {end - start} -c:v libx264 ...")
