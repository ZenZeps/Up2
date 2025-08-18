# 🏗️ GROUP MEMBERSHIPS COLLECTION - COMPLETE SCHEMA

## Missing Attributes to Add:

### 1. **acceptedAt** (DateTime, Optional)
```
Key: acceptedAt
Type: DateTime
Required: ❌ NO
Array: ❌ NO
Default: (none)
```
**Purpose**: Track when membership was accepted (for analytics)

### 2. **leftAt** (DateTime, Optional) 
```
Key: leftAt
Type: DateTime
Required: ❌ NO
Array: ❌ NO
Default: (none)
```
**Purpose**: Track when user left group (for re-invite logic)

---

## Role Enum Values:
Your `role` enum should include:
- `member` (default)
- `admin`
- `moderator`
- `owner`

## Status Enum Values:
Your `status` enum should include:
- `invited`
- `active` 
- `left`
- `banned`

---

## Groups Collection - Missing Optimization Fields:

Add these fields to the `groups` collection for performance:

### 1. **memberCount** (Integer)
```
Key: memberCount
Type: Integer
Required: ❌ NO
Array: ❌ NO
Default: 1
```

### 2. **lastActivityAt** (DateTime)
```
Key: lastActivityAt
Type: DateTime
Required: ❌ NO
Array: ❌ NO
Default: (none)
```

### 3. **tags** (String Array)
```
Key: tags
Type: String
Required: ❌ NO
Array: ✅ YES
Size: 50
Default: []
```

### 4. **popularityScore** (Float)
```
Key: popularityScore
Type: Float
Required: ❌ NO
Array: ❌ NO
Default: 0.0
```
