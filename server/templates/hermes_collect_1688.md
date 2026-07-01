请采集以下产品链接：

{{source_url}}

任务目标：
请帮我整理这个产品，用于后续生成 {{target_platform}} 电商套图。

品牌方向：
{{brand}}

产品分类：
{{category}}

你需要输出以下内容：

## 1. 产品电商原图素材包

请下载产品详情页中的：

- 主图
- 详情图
- SKU 图
- 颜色图
- 卖点图
- 包装图
- 使用场景图

要求：

- 保留原始图片。
- 图片按用途分类到不同文件夹。
- SKU 图片统一命名为 SKU01.jpg、SKU02.jpg、SKU03.jpg 这种格式。
- 如果能识别 SKU 名称，请同时记录 SKU 编号、颜色名、规格名。
- 不要把文件名写成中文或拼音。

## 2. 产品介绍

请输出 `product_intro.md`。

必须使用以下格式：

# Product Introduction

## 1. Basic Info

- Original Product Name:
- Suggested English Product Name:
- Suggested Project Name:
- Product Category:
- Brand:
- Target Platform:
- Source Link:

## 2. Product Summary

用 3-5 句话说明这个产品是什么、卖给谁、主要用途是什么。

## 3. Core Selling Points

1.
2.
3.
4.
5.

## 4. Visual Recognition Points

请描述 AI 生成图片时必须保留的外观特征：

- Bottle / Package Shape:
- Cap / Lid:
- Label:
- Material Texture:
- Main Color:
- Size Feeling:
- Special Details:

## 5. Usage Scenario

- Home manicure
- Nail salon
- Beginner friendly
- Professional nail artist
- Gift / collection
- Other:

## 6. Image Generation Notes

请说明生成图片时要注意：

- 哪些外观不能改变
- 哪些颜色必须保留
- 哪些文字不能乱写
- 是否需要突出多色可选
- 是否需要突出套装感
- 是否适合高端风格
- 是否适合清新风格
- 是否适合强促销风格

## 7. Suggested Gallery Image Plan

- Image 01 Main Image:
- Image 02 Selling Points:
- Image 03 Color Display:
- Image 04 Texture Detail:
- Image 05 Application Scene:
- Image 06 How To Use:
- Image 07 Long Lasting / Quality:
- Image 08 Brand Trust:
- Image 09 Package Includes:

## 8. Risk Notes

- 原图是否清晰：
- SKU 是否完整：
- 是否有侵权风险：
- 是否有中文需要去除：
- 是否有不适合海外平台的内容：

## 3. SKU 信息

请输出 `sku_info.md` 和 `sku_info.json`。

`sku_info.md` 使用表格：

| SKU ID | Original Name | English Name | Color / Spec | Image File | Need SKU Image |
|---|---|---|---|---|---|
| SKU01 |  |  |  | SKU01.jpg | Yes |

`sku_info.json` 使用以下格式：

```json
{
  "sku_list": [
    {
      "sku_id": "SKU01",
      "original_name": "",
      "english_name": "",
      "color_or_spec": "",
      "image_file": "SKU01.jpg",
      "need_sku_image": true,
      "notes": ""
    }
  ]
}
```

## 4. 采集总结

请输出 `hermes_result_summary.md`。

内容包括：

- 这个产品适合做哪些电商图
- 是否缺少关键素材
- 是否适合做白底素材提取
- 是否有 SKU 命名风险
- 是否有中文图片需要后续去除
- 是否有可能影响海外平台合规的问题

## 5. 输出要求

请把所有内容整理成一个标准文件夹，并压缩成 zip 包。

zip 包中至少包含：

- product_intro.md
- sku_info.md
- sku_info.json
- hermes_result_summary.md
- raw_material_package/

