from pathlib import Path

from PIL import Image, ImageOps


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "photos"
DESTINATION = ROOT / "apps" / "web" / "public" / "assets" / "players"
SIZE = (512, 512)

# centering is the normalized focal point retained while filling a square crop.
# Adjust these values when a source image changes; original photos are read-only.
PLAYERS = (
    ("ma-long", "马龙.jpg", (0.50, 0.50)),
    ("fan-zhendong", "樊振东.png", (0.50, 0.48)),
    ("zhang-jike", "张继科.jpg", (0.50, 0.48)),
    ("xu-xin", "许昕.jpg", (0.50, 0.45)),
    ("wang-chuqin", "王楚钦.jpg", (0.50, 0.48)),
    ("lin-gaoyuan", "林高远.jpg", (0.50, 0.50)),
    ("tomokazu-harimoto", "张本智和.jpg", (0.50, 0.48)),
    ("truls-moregard", "莫雷加德.png", (0.50, 0.45)),
)


def main() -> None:
    DESTINATION.mkdir(parents=True, exist_ok=True)
    for player_id, filename, focal_point in PLAYERS:
        source_path = SOURCE / filename
        if not source_path.is_file():
            raise FileNotFoundError(f"Missing source photo: {source_path}")
        with Image.open(source_path) as image:
            source_size = image.size
            portrait = ImageOps.fit(
                image.convert("RGB"),
                SIZE,
                method=Image.Resampling.LANCZOS,
                centering=focal_point,
            )
            output_path = DESTINATION / f"{player_id}.webp"
            portrait.save(output_path, format="WEBP", quality=88, method=6)
        print(f"{filename} {source_size[0]}x{source_size[1]} -> {output_path.name} 512x512")


if __name__ == "__main__":
    main()
