#!/usr/bin/env python3
"""
Reorganize the letter template to arrange photo1 and photo2 side-by-side in a table.
This creates a cleaner two-column layout for the generated PDF.
"""

import zipfile
import os
import shutil

docx_path = r'C:\Apple Scholar 2026\server\templates\letter-template.docx'
extract_dir = r'C:\Apple Scholar 2026\server\templates\letter-template-extracted'

# Backup original
shutil.copy(docx_path, docx_path.replace('.docx', '.backup2.docx'))

# Extract
if os.path.exists(extract_dir):
    shutil.rmtree(extract_dir)
os.makedirs(extract_dir)

with zipfile.ZipFile(docx_path, 'r') as z:
    z.extractall(extract_dir)

# Read document.xml as text
doc_xml_path = os.path.join(extract_dir, 'word', 'document.xml')
with open(doc_xml_path, 'r', encoding='utf-8') as f:
    doc_content = f.read()

print("Reorganizing template structure...")

# Create a table XML snippet for side-by-side photos
# This table has 2 columns and 2 rows (photos on top, captions on bottom)
table_xml = '''<w:tbl><w:tblPr><w:tblW w:w="9638" w:type="dxa"/><w:tblBorders><w:top w:val="nil" w:sz="0" w:space="0" w:color="auto"/><w:left w:val="nil" w:sz="0" w:space="0" w:color="auto"/><w:bottom w:val="nil" w:sz="0" w:space="0" w:color="auto"/><w:right w:val="nil" w:sz="0" w:space="0" w:color="auto"/><w:insideH w:val="nil" w:sz="0" w:space="0" w:color="auto"/><w:insideV w:val="nil" w:sz="0" w:space="0" w:color="auto"/></w:tblBorders><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="0" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="0" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid><w:gridCol w:w="4800"/><w:gridCol w:w="4800"/></w:tblGrid><w:tr><w:tcPr/><w:tc><w:tcPr><w:tcW w:w="4800" w:type="dxa"/></w:tcPr><w:p><w:r><w:t xml:space="preserve">{%photo1}</w:t></w:r></w:p></w:tc><w:tc><w:tcPr><w:tcW w:w="4800" w:type="dxa"/></w:tcPr><w:p><w:r><w:t xml:space="preserve">{%photo2}</w:t></w:r></w:p></w:tc></w:tr><w:tr><w:tcPr/><w:tc><w:tcPr><w:tcW w:w="4800" w:type="dxa"/></w:tcPr><w:p><w:r><w:t xml:space="preserve">{documentation1_caption}</w:t></w:r></w:p></w:tc><w:tc><w:tcPr><w:tcW w:w="4800" w:type="dxa"/></w:tcPr><w:p><w:r><w:t xml:space="preserve">{documentation2_caption}</w:t></w:r></w:p></w:tc></w:tr></w:tbl>'''

# Find and replace: look for the paragraph containing {%photo1} and extend to {documentation2_caption}
start_marker = '<w:p><w:r><w:t xml:space="preserve">{%photo1}</w:t></w:r></w:p>'
end_marker_caption2 = '<w:t xml:space="preserve">{documentation2_caption}</w:t></w:r></w:p>'

start_idx = doc_content.find(start_marker)
end_idx = doc_content.find(end_marker_caption2)

if start_idx != -1 and end_idx != -1:
    end_idx += len(end_marker_caption2)
    print(f"Found photo markers from index {start_idx} to {end_idx}")
    
    # Replace the entire section with the table
    new_doc_content = doc_content[:start_idx] + table_xml + doc_content[end_idx:]
    
    # Write back
    with open(doc_xml_path, 'w', encoding='utf-8') as f:
        f.write(new_doc_content)
    
    print("✓ Template structure updated to side-by-side table layout")
else:
    print("✗ Could not find photo markers")
    print(f"  start_marker found: {start_idx != -1}")
    print(f"  end_marker found: {end_idx != -1}")

# Repack the docx
print("Repacking DOCX...")
with zipfile.ZipFile(docx_path, 'w', zipfile.ZIP_DEFLATED) as z:
    for root_dir, dirs, files in os.walk(extract_dir):
        for file in files:
            file_path = os.path.join(root_dir, file)
            arcname = os.path.relpath(file_path, extract_dir)
            z.write(file_path, arcname)

print("✓ Template updated successfully!")

# Cleanup
shutil.rmtree(extract_dir)
