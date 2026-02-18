# Asset Licensing Checklist

Use this checklist before adding any image or LUT to the repository or application bundle.

## 1) Required Fields Per Asset

1. `asset_id`
2. `asset_type` (`image` or `lut`)
3. `source_url`
4. `source_owner`
5. `license_name`
6. `license_url` (or EULA document reference)
7. `redistribution_allowed` (`yes`/`no`/`unclear`)
8. `modification_allowed` (`yes`/`no`/`unclear`)
9. `commercial_use_allowed` (`yes`/`no`/`unclear`)
10. `attribution_required` (`yes`/`no`)
11. `attribution_text`
12. `reviewed_by`
13. `review_date`
14. `approval_status` (`approved`/`blocked`/`pending`)

## 2) Hard Gate Rules

1. Any asset with `approval_status != approved` must not be shipped.
2. Any asset with `redistribution_allowed != yes` must not be committed.
3. Any asset with unclear terms must be escalated and marked `blocked`.
4. Assets requiring attribution must have matching entry in release credits.

## 3) Suggested Manifest Shape

```json
{
  "assets": [
    {
      "asset_id": "classic_chrome_lut_v1",
      "asset_type": "lut",
      "source_url": "https://www.fujifilm-x.com/global/support/download/lut/",
      "source_owner": "FUJIFILM Corporation",
      "license_name": "Unknown (pending legal review)",
      "license_url": "",
      "redistribution_allowed": "unclear",
      "modification_allowed": "unclear",
      "commercial_use_allowed": "unclear",
      "attribution_required": "yes",
      "attribution_text": "",
      "reviewed_by": "",
      "review_date": "",
      "approval_status": "pending"
    }
  ]
}
```

## 4) Output Artifacts to Keep in Repo

1. `assets/images/metadata/*.json` for image-level provenance.
2. `luts/manifest.json` for LUT-level provenance and approvals.
3. `CREDITS.md` for user-visible attribution.

## 5) References

1. `/Users/nicoladimarco/code/fujirecipescreator/docs/research/source-validation-2026-02-16.md`
2. `/Users/nicoladimarco/code/fujirecipescreator/todos.md`
