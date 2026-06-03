import sys
from PIL import Image

def main():
    if len(sys.argv) < 3:
        print("Usage: python3 crop_to_16_9.py <input_path> <output_path> [y_start]")
        sys.exit(1)
        
    input_path = sys.argv[1]
    output_path = sys.argv[2]
    
    img = Image.open(input_path)
    width, height = img.size
    
    target_height = int(width * 9 / 16)
    
    # Allow specifying custom y_start, otherwise default to centering
    if len(sys.argv) > 3:
        y_start = int(sys.argv[3])
    else:
        # Default center crop
        y_start = (height - target_height) // 2
        
    y_end = y_start + target_height
    
    if y_end > height:
        y_end = height
        y_start = height - target_height
        
    cropped_img = img.crop((0, y_start, width, y_end))
    
    # Save as JPEG (high quality)
    cropped_img.save(output_path, "JPEG", quality=95)
    print(f"Cropped {input_path} ({width}x{height}) to {output_path} ({width}x{target_height}), y_start={y_start}")

if __name__ == "__main__":
    main()
