"""Production-only comparison of matching UI screenshots; no runtime dependency."""
import argparse
import json
from pathlib import Path
from PIL import Image, ImageChops, ImageStat


def compare(reference, candidate, output):
    with Image.open(reference) as a, Image.open(candidate) as b:
        if a.size != b.size:
            raise ValueError(f"Viewport mismatch: {a.size} != {b.size}")
        a, b = a.convert("RGB"), b.convert("RGB")
        diff = ImageChops.difference(a, b)
        channels = diff.split()
        max_diff = ImageChops.lighter(ImageChops.lighter(channels[0], channels[1]), channels[2])
        hist = max_diff.histogram()
        count = a.width * a.height
        output = Path(output)
        if output.resolve() in {Path(reference).resolve(), Path(candidate).resolve()}:
            raise ValueError("Output must not overwrite input")
        output.parent.mkdir(parents=True, exist_ok=True)
        diff.save(output)
        return {"size": list(a.size), "mean_absolute_rgb_error": round(sum(ImageStat.Stat(diff).mean)/3, 4),
                "changed_pixels_pct": round(100*(count-hist[0])/count, 4),
                "pixels_over_16_pct": round(100*sum(hist[17:])/count, 4)}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("reference")
    parser.add_argument("candidate")
    parser.add_argument("output")
    args = parser.parse_args()
    print(json.dumps(compare(args.reference, args.candidate, args.output), indent=2))
