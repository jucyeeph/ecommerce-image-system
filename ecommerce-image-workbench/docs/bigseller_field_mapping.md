# BigSeller Field Mapping

The parser uses a mapping layer instead of relying on exact template names.

| Normalized field | Common headers |
| --- | --- |
| `product_name` | `产品名称*`, `Product Name`, `Title` |
| `product_description` | `产品描述*`, `Description` |
| `parent_sku` | `Parent SKU` |
| `category` | `分类ID*`, `Category` |
| `supplier_url` | `供应商链接`, `Supplier URL` |
| `sku` | `SKU` |
| `variation_name` | `变种名称1`, `变种名称2` |
| `variation_option` | `变种选项1`, `变种选项2` |
| `main_image_urls` | headers containing `产品主图` |
| `detail_image_urls` | headers containing `产品附属图` |
| `variant_image_url` | `变种图` |
| `price` | `价格*`, `Price` |
| `promo_price` | `促销价`, `Promo Price` |
| `weight` | `重量（g）*`, `Weight` |
| `size` | `长（cm）`, `宽（cm）`, `高（cm）` |

Missing non-critical fields create warnings in `00_source/import_report.json`. Missing product name, Parent SKU, or all image URLs stops the import.

URL cells are split by comma, Chinese comma, whitespace, and line breaks. Only `http` and `https` URLs are kept; invalid values are reported.
