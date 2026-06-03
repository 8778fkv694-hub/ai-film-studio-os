import re
import csv
import os

def main():
    md_path = "/Users/yiliwen/开发/ai-film-studio-os/projects/vision/docs/keyframe-prompts-gemini.md"
    output_csv = "/Users/yiliwen/开发/ai-film-studio-os/projects/vision/docs/keyframe-prompts-combined.csv"
    output_txt = "/Users/yiliwen/开发/ai-film-studio-os/projects/vision/docs/keyframe-prompts-combined.txt"

    with open(md_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Extract STYLE/WORLD
    style_match = re.search(r'\*\*STYLE / WORLD \(prepend to every shot\):\*\*\s*```\s*(.*?)\s*```', content, re.DOTALL)
    if not style_match:
        print("Error: Could not find STYLE/WORLD block")
        return
    style_world = style_match.group(1).strip()

    # Extract Negative Prompts
    neg_match = re.search(r'\*\*统一规避项 \(Negative / avoid，每张都适用\):\*\*\s*```\s*(.*?)\s*```', content, re.DOTALL)
    if not neg_match:
        print("Error: Could not find Negative block")
        return
    negative_prompt = neg_match.group(1).strip()

    # Find shots
    # Shots are formatted as: ## 镜头 <Num> · <ShotID>(...)— <Title>
    # then English prompt: ``` ... ```
    shot_pattern = re.compile(
        r'##\s*镜头\s*\d+\s*·\s*([A-Za-z0-9]+).*?\*\*English prompt:\*\*\s*```\s*(.*?)\s*```', 
        re.DOTALL
    )
    
    shots = shot_pattern.findall(content)
    
    print(f"Found {len(shots)} shots:")
    
    csv_rows = []
    txt_content = []
    
    for shot_id, english_prompt in shots:
        english_prompt = english_prompt.strip()
        # Replace [STYLE/WORLD] placeholder
        full_prompt = english_prompt.replace("[STYLE/WORLD]", style_world)
        if "[STYLE/WORLD]" not in english_prompt:
            # If the placeholder wasn't used but we still want to prepend it:
            if not full_prompt.startswith(style_world[:20]):
                full_prompt = style_world + "\n" + full_prompt
                
        print(f"- {shot_id}")
        
        csv_rows.append({
            "Shot ID": shot_id,
            "Full Prompt": full_prompt,
            "Negative Prompt": negative_prompt
        })
        
        txt_content.append(f"=== {shot_id} ===")
        txt_content.append("PROMPT:")
        txt_content.append(full_prompt)
        txt_content.append("NEGATIVE PROMPT:")
        txt_content.append(negative_prompt)
        txt_content.append("\n" + "="*40 + "\n")

    # Write CSV
    with open(output_csv, 'w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=["Shot ID", "Full Prompt", "Negative Prompt"])
        writer.writeheader()
        writer.writerows(csv_rows)
        
    # Write TXT
    with open(output_txt, 'w', encoding='utf-8') as f:
        f.write("\n".join(txt_content))

    print(f"Successfully exported to:\n- {output_csv}\n- {output_txt}")

if __name__ == "__main__":
    main()
