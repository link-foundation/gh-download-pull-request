---
'gh-download-pull-request': minor
---

Add image download and processing support

- Download embedded images from PR body, comments, reviews, and review comments
- Support both Markdown (![alt](url)) and HTML (<img src="url">) image references
- Validate downloaded files by checking magic bytes (PNG, JPG, GIF, WebP, BMP, ICO, SVG)
- Detect and skip HTML error pages mistakenly downloaded as images
- Handle GitHub S3 signed URLs and redirects (up to 5 hops)
- Update markdown to reference local image paths
- Add JSON output format (--format json)
- Add new CLI options: --download-images, --include-reviews, --format, --verbose
