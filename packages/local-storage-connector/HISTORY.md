# History

## vNext

Add new queries for:
* `$exists`

## v0.4.3

Updated next-model dependency to `v0.4.1`

## v0.4.2

Updated next-model dependency to `v0.4.0`

## v0.4.1

Updated next-model dependency to `v0.3.0`

## v0.4.0

Stored nextId separately in LocalStorage.

This is changed to prevent id reuse after list got empty by deletions.

## v0.3.0

Improved browser compatibility.

## v0.2.0

Added `expect-change@0.0.1` which was missing in the previous release.

## v0.1.0

First release compatible with NextModel **0.2.0**.

Includes special queries for:
* $and
* $or
* $not
* $null
* $notNull
* $in
* $notIn
* $between
* $notBetween
* $eq
* $lt
* $lte
* $gt
* $gte
* $match
* $filter
