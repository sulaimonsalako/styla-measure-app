# STYLA QA fixtures — expected widget behaviour

Brand **STYLA QA (fixtures — do not ship)**, `brands.is_test = true`. Excluded from brand
ranking, chat and discovery. Charts are `source='qa', verified=true` so they DO serve when
targeted deliberately by `chartId`.

Test body used below: **chest 38, waist 31, hips 41, height 66, inseam 31, thigh 23**.

`POST /api/widget-size` with `{ "chartId": "<id>", ... }`, or assign the chart to a product.

| # | Fixture | chartId | Engine says | Score | Dims | insufficient | Widget MUST show |
|---|---|---|---|---|---|---|---|
| 01 | 01-control-normal | `089d2a07-06ed-4752-a90d-560e1bd9bf65` | M | 94% | 3 | no | A plausible size with a sane explanation |
| 02 | 02-empty | `23a2626a-5cd4-41fa-bc8b-9c92890fe5fb` | Unknown | 0% | 0 | **yes** | Honest "can't size this" state — never the word "Unknown" as a size |
| 03 | 03-names-only | `3da3b639-5598-4853-b006-9b8a34391386` | S | 0% | 0 | **yes** | Honest "can't size this" state |
| 04 | 04-height-only | `a5d5fdd1-1498-4585-b52f-5b6323842c94` | Regular | 0% | 0 | **yes** | Honest "can't size this" state |
| 05 | 05-cm-as-inches | `b48a8233-d5fb-4f29-8726-1a56eb33f8e9` | S | 0% | 3 | no | A plausible size with a sane explanation |
| 06 | 06-half-width | `9d74fd5e-8979-46fd-a154-fa7f6c1e2979` | M | 0% | 2 | no | A plausible size with a sane explanation |
| 07 | 07-single-size | `a69f47b5-3573-4484-b2ec-03cdf7b8a2ed` | One Size | 83% | 3 | no | "Other sizes" picker hidden or empty, no crash |
| 08 | 08-reversed | `f02bf5ae-326c-414e-940f-d825703763c0` | L | 79% | 2 | no | A plausible size with a sane explanation |
| 09 | 09-chest-under-waist | `62812a76-d103-4dee-99f7-7fbde8b1940e` | M | 34% | 2 | no | A plausible size with a sane explanation |
| 10 | 10-overlapping | `35aa9048-b55a-44aa-b006-6b9b8dc06054` | S | 69% | 1 | no | A plausible size with a sane explanation |
| 11 | 11-gapped | `44994dde-8efc-4a80-84d5-879a1ff21b07` | S | 63% | 1 | no | A plausible size with a sane explanation |
| 12 | 12-huge-values | `18ea49c3-ed9a-49ea-bb3f-0eb7e62015b2` | S | 0% | 2 | no | No Infinity/NaN anywhere in the fit text |
| 13 | 13-identical | `6b5da5d0-e78f-4f6f-92dd-d0b35c56953b` | S | 81% | 2 | no | A plausible size with a sane explanation |
| 14 | 14-unnamed-rows | `f89f4028-797b-4c92-8a35-626b5e33c6bf` | M | 74% | 2 | no | Only "M" offered; no blank/undefined entry in the size picker |
| 15 | 15-zero-and-negative | `e0c2cf91-4d22-4638-9c05-c585e9be500f` | S | 0% | 0 | **yes** | Honest "can't size this" state |
| 16 | 16-bottoms-critical | `a8f78990-663d-4b56-85ae-bdd76155b1f4` | 32 | 95% | 4 | no | A plausible size with a sane explanation |
| 17 | 17-sixty-sizes | `907390b8-eea2-4f8c-bf4f-82bd2005664e` | SZ37 | 87% | 3 | no | Size picker scrolls; no layout blowout |

## How to reset

```sql
delete from public.size_charts where brand_id in (select id from public.brands where is_test);
delete from public.brands where is_test;
```

