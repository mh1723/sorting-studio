/* ============================================================================
   algorithms.js
   Sorting "tracers": each runs a sort and records a list of frames so the UI
   can step through them.  Also holds the code listings (pseudocode / Python /
   Java) for each algorithm, with each line tagged so the player can highlight
   the line that matches the current step.

   A frame looks like:
     {
       array:  [...]          snapshot of the values at this step
       roles:  { index: 'compare' | 'swap' | 'pivot' | 'min' | 'key' |
                          'boundary' | 'sorted' }
       sorted: [indices already in final/locally-sorted position]
       range:  [lo, hi] | null   active sub-list (merge / quick)
       label:  'outer' | 'shift' | ...   which code line(s) to highlight
       desc:   'plain-english description of this step'
     }
   ============================================================================ */
(function (global) {
  'use strict';

  /* ----------------------------- array makers ----------------------------- */

  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const k = Math.floor(Math.random() * (i + 1));
      const t = a[i]; a[i] = a[k]; a[k] = t;
    }
    return a;
  }

  // preset: 'random' | 'nearly' | 'reversed' | 'few'
  function generateArray(n, preset) {
    n = Math.max(2, Math.min(40, n | 0));
    let a = [];

    if (preset === 'reversed') {
      for (let i = 0; i < n; i++) a.push(n - i);

    } else if (preset === 'nearly') {
      for (let i = 0; i < n; i++) a.push(i + 1);
      const swaps = Math.max(1, Math.round(n * 0.15));
      for (let s = 0; s < swaps; s++) {
        const i = Math.floor(Math.random() * (n - 1));
        const t = a[i]; a[i] = a[i + 1]; a[i + 1] = t;   // small local nudge
      }

    } else if (preset === 'few') {
      const buckets = [
        Math.max(1, Math.round(n * 0.2)),
        Math.max(1, Math.round(n * 0.5)),
        Math.max(1, Math.round(n * 0.8)),
        n
      ];
      for (let i = 0; i < n; i++) a.push(buckets[Math.floor(Math.random() * buckets.length)]);

    } else { // random permutation of 1..n  → distinct, evenly-spaced bar heights
      for (let i = 0; i < n; i++) a.push(i + 1);
      shuffle(a);
    }
    return a;
  }

  /* ------------------------------- tracers -------------------------------- */
  // Each returns an array of frames.  `f(label, desc, roles, range)` records one.

  function traceInsertion(input) {
    const a = input.slice(), n = a.length, frames = [], sorted = new Set();
    const f = (label, desc, roles, range) =>
      frames.push({ array: a.slice(), roles: roles || {}, sorted: Array.from(sorted), range: range || null, label, desc });

    // The "key" is held in a variable; we render it sitting in the current hole so
    // the picture is always a true permutation (the key bar travels left).
    sorted.add(0);
    f('start', 'The first element on its own is already a sorted sub-list.', {});

    for (let i = 1; i < n; i++) {
      const key = a[i];
      let hole = i;                 // a[hole] already holds the key value
      f('outer', `Take key = ${key} (A[${i}]). Find where it belongs in the sorted left part.`, { [hole]: 'key' });

      while (hole > 0 && a[hole - 1] > key) {
        f('inner_compare', `Is A[${hole - 1}] = ${a[hole - 1]} greater than key ${key}?  Yes — slide it right.`,
          { [hole - 1]: 'compare', [hole]: 'key' });
        a[hole] = a[hole - 1];      // slide neighbour up into the hole
        hole--;
        a[hole] = key;              // the key now occupies the new hole
        f('shift', `Slide ${a[hole + 1]} one place to the right; the key moves left.`,
          { [hole]: 'key', [hole + 1]: 'swap' });
      }
      if (hole > 0) {
        f('inner_compare', `Is A[${hole - 1}] = ${a[hole - 1]} greater than key ${key}?  No — the key stops here.`,
          { [hole - 1]: 'compare', [hole]: 'key' });
      }
      sorted.add(i);
      f('insert', `Drop key ${key} into position ${hole}. A[0..${i}] is now sorted.`, { [hole]: 'key' });
    }

    for (let i = 0; i < n; i++) sorted.add(i);
    f('done', 'Finished — the whole list is sorted.', {});
    return frames;
  }

  function traceSelection(input) {
    const a = input.slice(), n = a.length, frames = [], sorted = new Set();
    const f = (label, desc, roles, range) =>
      frames.push({ array: a.slice(), roles: roles || {}, sorted: Array.from(sorted), range: range || null, label, desc });

    f('start', 'Repeatedly pick the smallest element from the unsorted part.', {});

    for (let i = 0; i < n - 1; i++) {
      let m = i;
      f('outer', `Assume the smallest of the unsorted part is A[${i}] = ${a[i]}.`, { [i]: 'min' });
      for (let j = i + 1; j < n; j++) {
        f('find_min_compare', `Is A[${j}] = ${a[j]} smaller than the current min ${a[m]}?`, { [j]: 'compare', [m]: 'min' });
        if (a[j] < a[m]) {
          m = j;
          f('set_min', `Yes — the new smallest is A[${m}] = ${a[m]}.`, { [m]: 'min' });
        }
      }
      if (m !== i) {
        const t = a[i]; a[i] = a[m]; a[m] = t;
        f('swap', `Swap the smallest (${a[i]}) into position ${i}.`, { [i]: 'swap', [m]: 'swap' });
      } else {
        f('swap', `A[${i}] = ${a[i]} is already the smallest — no swap needed.`, { [i]: 'swap' });
      }
      sorted.add(i);
      f('placed', `Position ${i} is now fixed in its final place.`, {});
    }

    sorted.add(n - 1);
    f('done', 'Finished — the whole list is sorted.', {});
    return frames;
  }

  function traceMerge(input) {
    const a = input.slice(), n = a.length, frames = [], sorted = new Set();
    const f = (label, desc, roles, range) =>
      frames.push({ array: a.slice(), roles: roles || {}, sorted: Array.from(sorted), range: range || null, label, desc });

    function merge(lo, mid, hi) {
      const L = a.slice(lo, mid + 1), R = a.slice(mid + 1, hi + 1);
      let i = 0, j = 0, k = lo;
      // Keep the unplaced tail a[k..hi] showing the remaining L then R values, so
      // the picture stays a true permutation (two halves draining into the front).
      const refreshTail = () => {
        let p = k;
        for (let x = i; x < L.length; x++) a[p++] = L[x];
        for (let x = j; x < R.length; x++) a[p++] = R[x];
      };
      while (i < L.length && j < R.length) {
        // both compared values are on screen: left is at k, right is just past the
        // remaining left run — mark them both so the description's two values line up.
        const rPos = k + (L.length - i);
        f('merge_compare', `Merge [${lo}..${hi}]: compare left ${L[i]} with right ${R[j]}.`, { [k]: 'compare', [rPos]: 'compare' }, [lo, hi]);
        let from;
        if (L[i] <= R[j]) { a[k] = L[i]; i++; from = 'left'; }
        else { a[k] = R[j]; j++; from = 'right'; }
        const placed = a[k]; k++; refreshTail();
        f(from === 'left' ? 'merge_left' : 'merge_right',
          `${from === 'left' ? 'Left' : 'Right'} value ${placed} wins — place it at position ${k - 1}.`,
          { [k - 1]: 'swap' }, [lo, hi]);
      }
      while (i < L.length) { a[k] = L[i]; i++; const pos = k; k++; refreshTail(); f('merge_copy', `Copy leftover left value ${a[pos]} to position ${pos}.`, { [pos]: 'swap' }, [lo, hi]); }
      while (j < R.length) { a[k] = R[j]; j++; const pos = k; k++; refreshTail(); f('merge_copy', `Copy leftover right value ${a[pos]} to position ${pos}.`, { [pos]: 'swap' }, [lo, hi]); }
      f('merged', `Sub-list [${lo}..${hi}] is now merged and in order.`, {}, [lo, hi]);
    }

    function msort(lo, hi) {
      if (lo >= hi) return;
      const mid = (lo + hi) >> 1;
      f('split', `Split [${lo}..${hi}] into [${lo}..${mid}] and [${mid + 1}..${hi}].`, {}, [lo, hi]);
      msort(lo, mid);
      msort(mid + 1, hi);
      merge(lo, mid, hi);
    }

    f('start', 'Divide the list in half, sort each half, then merge them back together.', {});
    msort(0, n - 1);
    for (let i = 0; i < n; i++) sorted.add(i);
    f('done', 'Finished — the whole list is sorted.', {});
    return frames;
  }

  function traceQuick(input) {
    const a = input.slice(), n = a.length, frames = [], sorted = new Set();
    const f = (label, desc, roles, range) =>
      frames.push({ array: a.slice(), roles: roles || {}, sorted: Array.from(sorted), range: range || null, label, desc });

    function partition(lo, hi) {
      const pivot = a[hi];
      f('pivot_select', `Choose the pivot = A[${hi}] = ${pivot}. Smaller values go to its left.`, { [hi]: 'pivot' }, [lo, hi]);
      let i = lo - 1;
      for (let j = lo; j < hi; j++) {
        const roles = { [j]: 'compare', [hi]: 'pivot' };
        if (i >= lo) roles[i] = 'boundary';
        f('partition_compare', `Is A[${j}] = ${a[j]} less than the pivot ${pivot}?`, roles, [lo, hi]);
        if (a[j] < pivot) {
          i++;
          const moved = (i !== j);
          const t = a[i]; a[i] = a[j]; a[j] = t;
          if (moved) {
            f('partition_swap', `Yes — swap ${a[i]} into the "smaller" group at position ${i}.`, { [i]: 'swap', [j]: 'swap', [hi]: 'pivot' }, [lo, hi]);
          } else {
            f('partition_swap', `Yes — ${a[i]} already sits in the "smaller" group; the boundary just extends to position ${i}.`, { [i]: 'boundary', [hi]: 'pivot' }, [lo, hi]);
          }
        }
      }
      const t = a[i + 1]; a[i + 1] = a[hi]; a[hi] = t;
      f('place_pivot', `Put the pivot in its final spot: position ${i + 1}.`, { [i + 1]: 'swap', [hi]: 'swap' }, [lo, hi]);
      sorted.add(i + 1);
      f('pivot_placed', `${a[i + 1]} is now locked in its final sorted position.`, { [i + 1]: 'sorted' }, [lo, hi]);
      return i + 1;
    }

    function qsort(lo, hi) {
      if (lo > hi) return;
      if (lo === hi) {
        sorted.add(lo);
        f('base', `A sub-list of one element (position ${lo}) is already sorted.`, { [lo]: 'sorted' }, [lo, hi]);
        return;
      }
      f('recurse', `Sort sub-list [${lo}..${hi}]: partition it around a pivot, then sort each side.`, {}, [lo, hi]);
      const p = partition(lo, hi);
      qsort(lo, p - 1);
      qsort(p + 1, hi);
    }

    f('start', 'Pick a pivot, partition the list around it, then sort each side.', {});
    qsort(0, n - 1);
    for (let i = 0; i < n; i++) sorted.add(i);
    f('done', 'Finished — the whole list is sorted.', {});
    return frames;
  }

  /* ---------------------------- code listings ----------------------------- */
  // l = label that ties a line to a step.  Lines with no label never highlight.

  const CODE = {
    insertion: {
      pseudo: [
        { t: 'for i = 1 to n-1', l: 'outer' },
        { t: '    key = A[i]', l: 'outer' },
        { t: '    j = i - 1' },
        { t: '    while j >= 0 and A[j] > key', l: 'inner_compare' },
        { t: '        A[j+1] = A[j]', l: 'shift' },
        { t: '        j = j - 1', l: 'shift' },
        { t: '    A[j+1] = key', l: 'insert' }
      ],
      python: [
        { t: 'def insertion_sort(A):' },
        { t: '    for i in range(1, len(A)):', l: 'outer' },
        { t: '        key = A[i]', l: 'outer' },
        { t: '        j = i - 1' },
        { t: '        while j >= 0 and A[j] > key:', l: 'inner_compare' },
        { t: '            A[j + 1] = A[j]', l: 'shift' },
        { t: '            j -= 1', l: 'shift' },
        { t: '        A[j + 1] = key', l: 'insert' },
        { t: '    return A' }
      ],
      java: [
        { t: 'void insertionSort(int[] A) {' },
        { t: '    for (int i = 1; i < A.length; i++) {', l: 'outer' },
        { t: '        int key = A[i];', l: 'outer' },
        { t: '        int j = i - 1;' },
        { t: '        while (j >= 0 && A[j] > key) {', l: 'inner_compare' },
        { t: '            A[j + 1] = A[j];', l: 'shift' },
        { t: '            j--;', l: 'shift' },
        { t: '        }' },
        { t: '        A[j + 1] = key;', l: 'insert' },
        { t: '    }' },
        { t: '}' }
      ]
    },

    selection: {
      pseudo: [
        { t: 'for i = 0 to n-2', l: 'outer' },
        { t: '    min = i', l: 'outer' },
        { t: '    for j = i+1 to n-1' },
        { t: '        if A[j] < A[min]', l: 'find_min_compare' },
        { t: '            min = j', l: 'set_min' },
        { t: '    swap A[i] and A[min]', l: 'swap' }
      ],
      python: [
        { t: 'def selection_sort(A):' },
        { t: '    n = len(A)' },
        { t: '    for i in range(n - 1):', l: 'outer' },
        { t: '        m = i', l: 'outer' },
        { t: '        for j in range(i + 1, n):' },
        { t: '            if A[j] < A[m]:', l: 'find_min_compare' },
        { t: '                m = j', l: 'set_min' },
        { t: '        A[i], A[m] = A[m], A[i]', l: 'swap' },
        { t: '    return A' }
      ],
      java: [
        { t: 'void selectionSort(int[] A) {' },
        { t: '    int n = A.length;' },
        { t: '    for (int i = 0; i < n - 1; i++) {', l: 'outer' },
        { t: '        int m = i;', l: 'outer' },
        { t: '        for (int j = i + 1; j < n; j++) {' },
        { t: '            if (A[j] < A[m]) {', l: 'find_min_compare' },
        { t: '                m = j;', l: 'set_min' },
        { t: '            }' },
        { t: '        }' },
        { t: '        int t = A[i]; A[i] = A[m]; A[m] = t;', l: 'swap' },
        { t: '    }' },
        { t: '}' }
      ]
    },

    merge: {
      pseudo: [
        { t: 'function mergeSort(A, lo, hi)' },
        { t: '    if lo >= hi: return' },
        { t: '    mid = (lo + hi) / 2', l: 'split' },
        { t: '    mergeSort(A, lo, mid)', l: 'split' },
        { t: '    mergeSort(A, mid+1, hi)', l: 'split' },
        { t: '    merge(A, lo, mid, hi)', l: 'split' },
        { t: '' },
        { t: 'function merge(A, lo, mid, hi)' },
        { t: '    L = A[lo..mid],  R = A[mid+1..hi]' },
        { t: '    i = 0, j = 0, k = lo' },
        { t: '    while i < |L| and j < |R|', l: 'merge_compare' },
        { t: '        if L[i] <= R[j]: A[k]=L[i]; i++', l: 'merge_left' },
        { t: '        else:            A[k]=R[j]; j++', l: 'merge_right' },
        { t: '        k = k + 1' },
        { t: '    copy any leftover of L into A', l: 'merge_copy' },
        { t: '    copy any leftover of R into A', l: 'merge_copy' }
      ],
      python: [
        { t: 'def merge_sort(A, lo, hi):' },
        { t: '    if lo >= hi:' },
        { t: '        return' },
        { t: '    mid = (lo + hi) // 2', l: 'split' },
        { t: '    merge_sort(A, lo, mid)', l: 'split' },
        { t: '    merge_sort(A, mid + 1, hi)', l: 'split' },
        { t: '    merge(A, lo, mid, hi)', l: 'split' },
        { t: '' },
        { t: 'def merge(A, lo, mid, hi):' },
        { t: '    L = A[lo:mid + 1]' },
        { t: '    R = A[mid + 1:hi + 1]' },
        { t: '    i = j = 0; k = lo' },
        { t: '    while i < len(L) and j < len(R):', l: 'merge_compare' },
        { t: '        if L[i] <= R[j]:' },
        { t: '            A[k] = L[i]; i += 1', l: 'merge_left' },
        { t: '        else:' },
        { t: '            A[k] = R[j]; j += 1', l: 'merge_right' },
        { t: '        k += 1' },
        { t: '    while i < len(L): A[k]=L[i]; i+=1; k+=1', l: 'merge_copy' },
        { t: '    while j < len(R): A[k]=R[j]; j+=1; k+=1', l: 'merge_copy' }
      ],
      java: [
        { t: 'void mergeSort(int[] A, int lo, int hi) {' },
        { t: '    if (lo >= hi) return;' },
        { t: '    int mid = (lo + hi) / 2;', l: 'split' },
        { t: '    mergeSort(A, lo, mid);', l: 'split' },
        { t: '    mergeSort(A, mid + 1, hi);', l: 'split' },
        { t: '    merge(A, lo, mid, hi);', l: 'split' },
        { t: '}' },
        { t: '' },
        { t: 'void merge(int[] A, int lo, int mid, int hi) {' },
        { t: '    int[] L = copyOfRange(A, lo, mid + 1);' },
        { t: '    int[] R = copyOfRange(A, mid + 1, hi + 1);' },
        { t: '    int i = 0, j = 0, k = lo;' },
        { t: '    while (i < L.length && j < R.length) {', l: 'merge_compare' },
        { t: '        if (L[i] <= R[j]) A[k++] = L[i++];', l: 'merge_left' },
        { t: '        else              A[k++] = R[j++];', l: 'merge_right' },
        { t: '    }' },
        { t: '    while (i < L.length) A[k++] = L[i++];', l: 'merge_copy' },
        { t: '    while (j < R.length) A[k++] = R[j++];', l: 'merge_copy' }
      ]
    },

    quick: {
      pseudo: [
        { t: 'function quickSort(A, lo, hi)' },
        { t: '    if lo >= hi: return', l: 'base' },
        { t: '    p = partition(A, lo, hi)', l: 'recurse' },
        { t: '    quickSort(A, lo, p-1)', l: 'recurse' },
        { t: '    quickSort(A, p+1, hi)', l: 'recurse' },
        { t: '' },
        { t: 'function partition(A, lo, hi)' },
        { t: '    pivot = A[hi]', l: 'pivot_select' },
        { t: '    i = lo - 1' },
        { t: '    for j = lo to hi-1', l: 'partition_compare' },
        { t: '        if A[j] < pivot', l: 'partition_compare' },
        { t: '            i = i + 1' },
        { t: '            swap A[i] and A[j]', l: 'partition_swap' },
        { t: '    swap A[i+1] and A[hi]', l: 'place_pivot' },
        { t: '    return i + 1' }
      ],
      python: [
        { t: 'def quick_sort(A, lo, hi):' },
        { t: '    if lo >= hi:', l: 'base' },
        { t: '        return', l: 'base' },
        { t: '    p = partition(A, lo, hi)', l: 'recurse' },
        { t: '    quick_sort(A, lo, p - 1)', l: 'recurse' },
        { t: '    quick_sort(A, p + 1, hi)', l: 'recurse' },
        { t: '' },
        { t: 'def partition(A, lo, hi):' },
        { t: '    pivot = A[hi]', l: 'pivot_select' },
        { t: '    i = lo - 1' },
        { t: '    for j in range(lo, hi):', l: 'partition_compare' },
        { t: '        if A[j] < pivot:', l: 'partition_compare' },
        { t: '            i += 1' },
        { t: '            A[i], A[j] = A[j], A[i]', l: 'partition_swap' },
        { t: '    A[i+1], A[hi] = A[hi], A[i+1]', l: 'place_pivot' },
        { t: '    return i + 1' }
      ],
      java: [
        { t: 'void quickSort(int[] A, int lo, int hi) {' },
        { t: '    if (lo >= hi) return;', l: 'base' },
        { t: '    int p = partition(A, lo, hi);', l: 'recurse' },
        { t: '    quickSort(A, lo, p - 1);', l: 'recurse' },
        { t: '    quickSort(A, p + 1, hi);', l: 'recurse' },
        { t: '}' },
        { t: '' },
        { t: 'int partition(int[] A, int lo, int hi) {' },
        { t: '    int pivot = A[hi];', l: 'pivot_select' },
        { t: '    int i = lo - 1;' },
        { t: '    for (int j = lo; j < hi; j++) {', l: 'partition_compare' },
        { t: '        if (A[j] < pivot) {', l: 'partition_compare' },
        { t: '            i++;' },
        { t: '            int t=A[i]; A[i]=A[j]; A[j]=t;', l: 'partition_swap' },
        { t: '        }' },
        { t: '    }' },
        { t: '    int t=A[i+1]; A[i+1]=A[hi]; A[hi]=t;', l: 'place_pivot' },
        { t: '    return i + 1;' },
        { t: '}' }
      ]
    }
  };

  /* -------------------------------- export -------------------------------- */

  global.Sorting = {
    generateArray,
    CODE,
    ALGOS: [
      { id: 'insertion', name: 'Insertion Sort', complexity: 'O(n²)',       best: 'O(n)',        trace: traceInsertion },
      { id: 'selection', name: 'Selection Sort', complexity: 'O(n²)',       best: 'O(n²)',       trace: traceSelection },
      { id: 'merge',     name: 'Merge Sort',     complexity: 'O(n log n)',  best: 'O(n log n)',  trace: traceMerge },
      { id: 'quick',     name: 'Quick Sort',     complexity: 'O(n log n)',  best: 'O(n²) worst', trace: traceQuick }
    ]
  };

})(window);
