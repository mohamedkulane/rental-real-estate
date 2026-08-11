# RentableSpace Model

RentableSpace is the sole canonical physical occupancy target. Stable identity (`id`, Property, optional Building, type, code, name) is separated from effective measurements. Physical status is independent of future availability, service model, reservation, or lease state.

Recursive topology is stored as effective-dated parent history using `[from,to)`. Parent and child must share a Property, cycles are prohibited, and active child usable area in one unit cannot exceed the effective active parent area. Measurement corrections create a new version and close the prior version. Retirement closes active physical histories but never deletes them.

Partition operations lock the physical context, validate effective measurements and aggregate area, create children and first versions atomically, retain parent identity, and write audit evidence.
