export function generatePrompts({ product, skus, imageCounts }) {
  const productType = product.productName.toLowerCase().includes('gel') ? 'Cat Eye Gel Nail Polish' : 'Ecommerce Product';
  return {
    'project_prompt_brief.md': `# 项目提示词简报

## 产品基础信息

- 产品名称：${product.productName}
- Parent SKU：${product.parentSku}
- 产品类型：${productType}
- 品牌：${product.brand || 'JUCYEE | BOMD'}
- SKU 数量：${skus.length}
- 主要卖点：${summarizeSellingPoints(product.productDescription)}

## 可用素材

- 主图数量：${imageCounts.main}
- 详情图数量：${imageCounts.detail}
- SKU 图数量：${imageCounts.sku}

## 视觉方向

高级商业电商图，极简构图，真实产品材质，柔和工作室灯光，电影光影，干净背景，适合 Shopee / TikTok Shop 手机端浏览。

## 后续任务

1. 生成 1:1 主图。
2. 生成卖点图。
3. 生成色卡图。
4. 生成 SKU 图。
`,
    'image_01_main_prompt.md': `# 图 1：电商主图提示词草稿

## 目标

生成一张 1200x1200 的高端电商主图，用于 Shopee / TikTok Shop 商品首图。

## 参考素材

- 产品主图：../01_downloaded_images/main/
- SKU 色卡图：../01_downloaded_images/sku/

## 正面提示词

1200x1200 square ecommerce hero image, premium minimalist product photography, ${product.productName}, keep the exact real product appearance, bottle shape, label, logo, cap, packaging structure, material, and product color unchanged, clean luxury composition, elegant studio photography, realistic commercial product shot, high-end brand visual language, soft studio lighting, cinematic shadows, natural highlights, refined reflections, realistic glossy material, clean background, subtle gradient background, mobile thumbnail readability, neat layout, sophisticated typography, JUCYEE | BOMD logo centered at the top, selected color swatches displayed neatly on the side, premium editorial advertising style.

## 反面提示词

cluttered layout, messy composition, too many text elements, unreadable small text, distorted product shape, changed product packaging, changed label, fake brand logo, low-resolution image, plastic-looking material, overexposed highlights, harsh shadows, cartoon style, Chinese text, watermark.
`,
    'image_02_selling_points_prompt.md': `# 图 2：卖点图提示词草稿

Create a 1200x1200 premium ecommerce selling-points image for ${product.productName}. Keep the product appearance unchanged. Show clear benefits with restrained English typography: glossy cat eye magnetic effect, 15ml bottle, UV/LED gel routine, salon and home manicure use. Use clean composition, soft studio lighting, luxury beauty product styling, mobile-readable layout, and realistic product material.
`,
    'image_03_color_chart_prompt.md': `# 图 3：色卡图提示词草稿

Create a 1200x1200 premium color chart image using the SKU reference images. Keep every shade accurate and do not invent colors. Arrange ${skus.length} shades in a clean grid with readable SKU labels, soft neutral background, JUCYEE | BOMD brand style, and mobile-friendly spacing.
`,
    'image_04_texture_prompt.md': `# 图 4：质地图提示词草稿

Create a 1200x1200 macro texture ecommerce image that highlights glossy magnetic shimmer, glass-bead cat eye reflection, refined sparkle, and realistic gel polish material. Keep the product identity and shade behavior believable. Use premium studio lighting, elegant shadows, and clean beauty-ad composition.
`,
    'sku_image_prompt_template.md': `# SKU 图提示词模板

## 目标

为每个 SKU 生成统一风格的 SKU 展示图，保持产品颜色、瓶身、标签和色号准确，不改变实物外观。

## 变量

- SKU：{{sku}}
- 色号：{{variation_option}}
- 参考图：{{local_image_path}}

## 正面提示词

Create a 1200x1200 premium ecommerce SKU image for {{sku}}, using the provided product reference image. Keep the exact product bottle shape, label design, color number, cap, packaging structure, and product color unchanged. Use clean luxury studio lighting, soft shadows, realistic glossy material, refined reflections, minimal premium background, mobile-friendly composition, JUCYEE | BOMD brand style, elegant ecommerce visual language.

## 反面提示词

changed bottle shape, changed label text, wrong color number, wrong product color, extra products, messy background, low resolution, distorted logo, unreadable SKU, Chinese text, watermark, cartoon style, unrealistic material.
`
  };
}

function summarizeSellingPoints(description) {
  const text = String(description || '').replace(/\s+/g, ' ').trim();
  return text ? text.slice(0, 220) : '待根据产品描述补充。';
}
