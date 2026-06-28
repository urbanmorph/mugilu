// Self-contained QR code generator for Cloudflare Workers: no npm deps, no Node, no DOM, no network.
// Ported faithfully from the Project Nayuki "QR Code generator" reference library (MIT License): https://www.nayuki.io/page/qr-code-generator-library

/**
 * Returns a complete, scalable `<svg>...</svg>` string encoding `text` as a QR code.
 *
 * The SVG uses a viewBox of the module grid (including the quiet zone) with
 * width/height of 100%, so the caller sizes it purely via CSS. Dark modules are
 * emitted as one combined `<path>`, the light background as a single `<rect>`.
 *
 * Encoding: byte mode over UTF-8, error correction level MEDIUM, automatic version.
 *
 * @param text the string to encode (URLs up to roughly 120 chars encode fine).
 * @param opts.border quiet-zone width in modules (default 4).
 * @param opts.dark hex colour for dark modules (default "#0b1220").
 * @param opts.light hex colour for the background (default "#ffffff").
 */
export function qrSvg(text: string, opts?: { border?: number; dark?: string; light?: string }): string {
  const border = opts?.border ?? 4;
  const dark = opts?.dark ?? "#0b1220";
  const light = opts?.light ?? "#ffffff";
  if (border < 0 || !Number.isInteger(border)) throw new RangeError("Border must be a non-negative integer");

  const segment = QrSegment.makeBytes(toUtf8Bytes(text));
  // boostEcl is left off so the error correction level stays fixed at MEDIUM as requested.
  const qr = QrCode.encodeSegments([segment], Ecc.MEDIUM, 1, 40, -1, false);

  const size = qr.size;
  const dim = size + border * 2;

  const parts: string[] = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (qr.getModule(x, y)) parts.push(`M${x + border},${y + border}h1v1h-1z`);
    }
  }
  const path = parts.join("");

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dim} ${dim}" ` +
    `width="100%" height="100%" shape-rendering="crispEdges" role="img" aria-label="QR code">` +
    `<rect width="${dim}" height="${dim}" fill="${light}"/>` +
    `<path d="${path}" fill="${dark}"/>` +
    `</svg>`
  );
}

/** Encodes a JavaScript string to its UTF-8 byte sequence, surrogate pairs included. */
function toUtf8Bytes(str: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < str.length; i++) {
    let code = str.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff && i + 1 < str.length) {
      const next = str.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        code = 0x10000 + ((code - 0xd800) << 10) + (next - 0xdc00);
        i++;
      }
    }
    if (code < 0x80) {
      out.push(code);
    } else if (code < 0x800) {
      out.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code < 0x10000) {
      out.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    } else {
      out.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 0x3f), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    }
  }
  return out;
}

// Appends the `len` low bits of `val` (big-endian) to the bit buffer `bb`.
function appendBits(bb: number[], val: number, len: number): void {
  if (len < 0 || len > 31 || val >>> len != 0) throw new RangeError("Value out of range");
  for (let i = len - 1; i >= 0; i--) bb.push((val >>> i) & 1);
}

// Returns true if the bit at index `i` (from the least significant) of `x` is set.
function getBit(x: number, i: number): boolean {
  return ((x >>> i) & 1) != 0;
}

/** The error correction level in a QR code symbol. */
class Ecc {
  public static readonly LOW = new Ecc(0, 1);
  public static readonly MEDIUM = new Ecc(1, 0);
  public static readonly QUARTILE = new Ecc(2, 3);
  public static readonly HIGH = new Ecc(3, 2);

  // ordinal indexes the ECC tables; formatBits is the 2-bit value stored in the format info.
  private constructor(
    public readonly ordinal: number,
    public readonly formatBits: number,
  ) {}
}

/** A segment encoding mode. This port supports byte mode, which carries any UTF-8 text. */
class Mode {
  public static readonly BYTE = new Mode(0x4, [8, 16, 16]);

  private constructor(
    public readonly modeBits: number,
    private readonly numBitsCharCount: [number, number, number],
  ) {}

  // The bit width of the character count field for the given version (1 to 40).
  public numCharCountBits(ver: number): number {
    return this.numBitsCharCount[Math.floor((ver + 7) / 17)];
  }
}

/** A piece of user data converted into a sequence of bits in a given mode. */
class QrSegment {
  /** Builds a byte-mode segment from the given raw bytes. */
  public static makeBytes(data: readonly number[]): QrSegment {
    const bb: number[] = [];
    for (const b of data) appendBits(bb, b, 8);
    return new QrSegment(Mode.BYTE, data.length, bb);
  }

  // The total number of bits needed to encode all the segments at the given version.
  // Returns Infinity if a segment has too many characters to fit the version.
  public static getTotalBits(segs: readonly QrSegment[], version: number): number {
    let result = 0;
    for (const seg of segs) {
      const ccbits = seg.mode.numCharCountBits(version);
      if (seg.numChars >= 1 << ccbits) return Infinity;
      result += 4 + ccbits + seg.bitData.length;
    }
    return result;
  }

  private constructor(
    public readonly mode: Mode,
    public readonly numChars: number,
    private readonly bitData: number[],
  ) {
    if (numChars < 0) throw new RangeError("Invalid argument");
  }

  public getData(): number[] {
    return this.bitData.slice();
  }
}

/** A QR code symbol: an immutable square grid of dark and light modules. */
class QrCode {
  public static readonly MIN_VERSION = 1;
  public static readonly MAX_VERSION = 40;

  // Penalty weights for mask selection, from the QR specification.
  private static readonly PENALTY_N1 = 3;
  private static readonly PENALTY_N2 = 3;
  private static readonly PENALTY_N3 = 40;
  private static readonly PENALTY_N4 = 10;

  // Number of error correction codewords per block, indexed by [ecl.ordinal][version].
  private static readonly ECC_CODEWORDS_PER_BLOCK: number[][] = [
    // Version 0 is unused padding, set to an illegal value.
    [
      -1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30,
      30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30,
    ], // Low
    [
      -1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28,
      28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28,
    ], // Medium
    [
      -1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30,
      30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30,
    ], // Quartile
    [
      -1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30,
      30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30,
    ], // High
  ];

  // Number of error correction blocks, indexed by [ecl.ordinal][version].
  private static readonly NUM_ERROR_CORRECTION_BLOCKS: number[][] = [
    // Version 0 is unused padding, set to an illegal value.
    [
      -1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18,
      19, 19, 20, 21, 22, 24, 25,
    ], // Low
    [
      -1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31,
      33, 35, 37, 38, 40, 43, 45, 47, 49,
    ], // Medium
    [
      -1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40,
      43, 45, 48, 51, 53, 56, 59, 62, 65, 68,
    ], // Quartile
    [
      -1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48,
      51, 54, 57, 60, 63, 66, 70, 74, 77, 81,
    ], // High
  ];

  public readonly size: number;
  public readonly mask: number;

  // The grid of modules (true is dark) and a parallel grid marking function (reserved) cells.
  private readonly modules: boolean[][] = [];
  private readonly isFunction: boolean[][] = [];

  /**
   * Returns a QR code representing the given segments at the given error correction level,
   * choosing the smallest version that fits between minVersion and maxVersion. A mask of -1
   * automatically selects the lowest-penalty mask. When boostEcl is true the error correction
   * level may be increased if the chosen version has spare capacity.
   */
  public static encodeSegments(
    segs: readonly QrSegment[],
    ecl: Ecc,
    minVersion = 1,
    maxVersion = 40,
    mask = -1,
    boostEcl = true,
  ): QrCode {
    if (
      !(QrCode.MIN_VERSION <= minVersion && minVersion <= maxVersion && maxVersion <= QrCode.MAX_VERSION) ||
      mask < -1 ||
      mask > 7
    )
      throw new RangeError("Invalid value");

    // Find the smallest version that holds the data.
    let version: number;
    let dataUsedBits: number;
    for (version = minVersion; ; version++) {
      const dataCapacityBits = QrCode.getNumDataCodewords(version, ecl) * 8;
      const usedBits = QrSegment.getTotalBits(segs, version);
      if (usedBits <= dataCapacityBits) {
        dataUsedBits = usedBits;
        break;
      }
      if (version >= maxVersion) throw new RangeError("Data too long");
    }

    // Optionally boost the error correction level within the chosen version.
    for (const newEcl of [Ecc.MEDIUM, Ecc.QUARTILE, Ecc.HIGH]) {
      if (boostEcl && dataUsedBits <= QrCode.getNumDataCodewords(version, newEcl) * 8) ecl = newEcl;
    }

    // Concatenate all segments into a single bit buffer.
    const bb: number[] = [];
    for (const seg of segs) {
      appendBits(bb, seg.mode.modeBits, 4);
      appendBits(bb, seg.numChars, seg.mode.numCharCountBits(version));
      for (const b of seg.getData()) bb.push(b);
    }

    // Add terminator and pad up to a byte boundary, then add pad bytes.
    const dataCapacityBits = QrCode.getNumDataCodewords(version, ecl) * 8;
    appendBits(bb, 0, Math.min(4, dataCapacityBits - bb.length));
    appendBits(bb, 0, (8 - (bb.length % 8)) % 8);
    for (let padByte = 0xec; bb.length < dataCapacityBits; padByte ^= 0xec ^ 0x11) appendBits(bb, padByte, 8);

    // Pack bits into bytes, big-endian.
    const dataCodewords: number[] = [];
    while (dataCodewords.length * 8 < bb.length) dataCodewords.push(0);
    bb.forEach((b, i) => (dataCodewords[i >>> 3] |= b << (7 - (i & 7))));

    return new QrCode(version, ecl, dataCodewords, mask);
  }

  private constructor(
    public readonly version: number,
    public readonly errorCorrectionLevel: Ecc,
    dataCodewords: readonly number[],
    msk: number,
  ) {
    if (version < QrCode.MIN_VERSION || version > QrCode.MAX_VERSION)
      throw new RangeError("Version value out of range");
    if (msk < -1 || msk > 7) throw new RangeError("Mask value out of range");
    this.size = version * 4 + 17;

    const row: boolean[] = [];
    for (let i = 0; i < this.size; i++) row.push(false);
    for (let i = 0; i < this.size; i++) {
      this.modules.push(row.slice());
      this.isFunction.push(row.slice());
    }

    this.drawFunctionPatterns();
    const allCodewords = this.addEccAndInterleave(dataCodewords);
    this.drawCodewords(allCodewords);

    // Pick the mask with the lowest penalty if not specified.
    if (msk == -1) {
      let minPenalty = Infinity;
      for (let i = 0; i < 8; i++) {
        this.applyMask(i);
        this.drawFormatBits(i);
        const penalty = this.getPenaltyScore();
        if (penalty < minPenalty) {
          msk = i;
          minPenalty = penalty;
        }
        this.applyMask(i); // Undo the mask.
      }
    }
    this.mask = msk;
    this.applyMask(msk);
    this.drawFormatBits(msk);
  }

  /** Returns the colour of the module at (x, y): true is dark, false is light or out of bounds. */
  public getModule(x: number, y: number): boolean {
    return 0 <= x && x < this.size && 0 <= y && y < this.size && this.modules[y][x];
  }

  private drawFunctionPatterns(): void {
    // Timing patterns.
    for (let i = 0; i < this.size; i++) {
      this.setFunctionModule(6, i, i % 2 == 0);
      this.setFunctionModule(i, 6, i % 2 == 0);
    }

    // The three finder patterns at the corners.
    this.drawFinderPattern(3, 3);
    this.drawFinderPattern(this.size - 4, 3);
    this.drawFinderPattern(3, this.size - 4);

    // The alignment patterns.
    const alignPatPos = this.getAlignmentPatternPositions();
    const numAlign = alignPatPos.length;
    for (let i = 0; i < numAlign; i++) {
      for (let j = 0; j < numAlign; j++) {
        // Skip the three positions that overlap finder patterns.
        if (!((i == 0 && j == 0) || (i == 0 && j == numAlign - 1) || (i == numAlign - 1 && j == 0)))
          this.drawAlignmentPattern(alignPatPos[i], alignPatPos[j]);
      }
    }

    // Reserve the format and version areas with dummy data.
    this.drawFormatBits(0);
    this.drawVersion();
  }

  private drawFormatBits(mask: number): void {
    const data = (this.errorCorrectionLevel.formatBits << 3) | mask;
    let rem = data;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const bits = ((data << 10) | rem) ^ 0x5412;

    // First copy, around the top-left finder.
    for (let i = 0; i <= 5; i++) this.setFunctionModule(8, i, getBit(bits, i));
    this.setFunctionModule(8, 7, getBit(bits, 6));
    this.setFunctionModule(8, 8, getBit(bits, 7));
    this.setFunctionModule(7, 8, getBit(bits, 8));
    for (let i = 9; i < 15; i++) this.setFunctionModule(14 - i, 8, getBit(bits, i));

    // Second copy, split across the other two finders.
    for (let i = 0; i < 8; i++) this.setFunctionModule(this.size - 1 - i, 8, getBit(bits, i));
    for (let i = 8; i < 15; i++) this.setFunctionModule(8, this.size - 15 + i, getBit(bits, i));
    this.setFunctionModule(8, this.size - 8, true); // Always dark.
  }

  private drawVersion(): void {
    if (this.version < 7) return;
    let rem = this.version;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const bits = (this.version << 12) | rem;

    for (let i = 0; i < 18; i++) {
      const color = getBit(bits, i);
      const a = this.size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      this.setFunctionModule(a, b, color);
      this.setFunctionModule(b, a, color);
    }
  }

  private drawFinderPattern(x: number, y: number): void {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const dist = Math.max(Math.abs(dx), Math.abs(dy)); // Chebyshev distance.
        const xx = x + dx;
        const yy = y + dy;
        if (0 <= xx && xx < this.size && 0 <= yy && yy < this.size)
          this.setFunctionModule(xx, yy, dist != 2 && dist != 4);
      }
    }
  }

  private drawAlignmentPattern(x: number, y: number): void {
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++)
        this.setFunctionModule(x + dx, y + dy, Math.max(Math.abs(dx), Math.abs(dy)) != 1);
    }
  }

  private setFunctionModule(x: number, y: number, isDark: boolean): void {
    this.modules[y][x] = isDark;
    this.isFunction[y][x] = true;
  }

  // Computes the error correction codewords for each block and returns the interleaved sequence.
  private addEccAndInterleave(data: readonly number[]): number[] {
    const ver = this.version;
    const ecl = this.errorCorrectionLevel;
    if (data.length != QrCode.getNumDataCodewords(ver, ecl)) throw new RangeError("Invalid argument");

    const numBlocks = QrCode.NUM_ERROR_CORRECTION_BLOCKS[ecl.ordinal][ver];
    const blockEccLen = QrCode.ECC_CODEWORDS_PER_BLOCK[ecl.ordinal][ver];
    const rawCodewords = Math.floor(QrCode.getNumRawDataModules(ver) / 8);
    const numShortBlocks = numBlocks - (rawCodewords % numBlocks);
    const shortBlockLen = Math.floor(rawCodewords / numBlocks);

    const blocks: number[][] = [];
    const rsDiv = QrCode.reedSolomonComputeDivisor(blockEccLen);
    for (let i = 0, k = 0; i < numBlocks; i++) {
      const dat = data.slice(k, k + shortBlockLen - blockEccLen + (i < numShortBlocks ? 0 : 1));
      k += dat.length;
      const ecc = QrCode.reedSolomonComputeRemainder(dat, rsDiv);
      if (i < numShortBlocks) dat.push(0);
      blocks.push(dat.concat(ecc));
    }

    // Interleave the bytes from every block.
    const result: number[] = [];
    for (let i = 0; i < blocks[0].length; i++) {
      blocks.forEach((block, j) => {
        // Skip the padding byte that only short blocks have.
        if (i != shortBlockLen - blockEccLen || j >= numShortBlocks) result.push(block[i]);
      });
    }
    return result;
  }

  // Draws the interleaved codewords onto the grid in the standard zigzag order.
  private drawCodewords(data: readonly number[]): void {
    if (data.length != Math.floor(QrCode.getNumRawDataModules(this.version) / 8))
      throw new RangeError("Invalid argument");

    let i = 0; // Bit index into the data.
    for (let right = this.size - 1; right >= 1; right -= 2) {
      if (right == 6) right = 5; // Skip the vertical timing column.
      for (let vert = 0; vert < this.size; vert++) {
        for (let j = 0; j < 2; j++) {
          const x = right - j;
          const upward = ((right + 1) & 2) == 0;
          const y = upward ? this.size - 1 - vert : vert;
          if (!this.isFunction[y][x] && i < data.length * 8) {
            this.modules[y][x] = getBit(data[i >>> 3], 7 - (i & 7));
            i++;
          }
        }
      }
    }
  }

  // XORs the given mask pattern over all non-function modules. Applying twice undoes it.
  private applyMask(mask: number): void {
    if (mask < 0 || mask > 7) throw new RangeError("Mask value out of range");
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        let invert: boolean;
        switch (mask) {
          case 0:
            invert = (x + y) % 2 == 0;
            break;
          case 1:
            invert = y % 2 == 0;
            break;
          case 2:
            invert = x % 3 == 0;
            break;
          case 3:
            invert = (x + y) % 3 == 0;
            break;
          case 4:
            invert = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 == 0;
            break;
          case 5:
            invert = ((x * y) % 2) + ((x * y) % 3) == 0;
            break;
          case 6:
            invert = (((x * y) % 2) + ((x * y) % 3)) % 2 == 0;
            break;
          case 7:
            invert = (((x + y) % 2) + ((x * y) % 3)) % 2 == 0;
            break;
          default:
            throw new Error("Unreachable");
        }
        if (!this.isFunction[y][x] && invert) this.modules[y][x] = !this.modules[y][x];
      }
    }
  }

  // Computes the total penalty for the current grid, used to pick the best mask.
  private getPenaltyScore(): number {
    let result = 0;

    // Penalty for runs of same-colour modules in each row.
    for (let y = 0; y < this.size; y++) {
      let runColor = false;
      let runX = 0;
      const runHistory = [0, 0, 0, 0, 0, 0, 0];
      for (let x = 0; x < this.size; x++) {
        if (this.modules[y][x] == runColor) {
          runX++;
          if (runX == 5) result += QrCode.PENALTY_N1;
          else if (runX > 5) result++;
        } else {
          this.finderPenaltyAddHistory(runX, runHistory);
          if (!runColor) result += this.finderPenaltyCountPatterns(runHistory) * QrCode.PENALTY_N3;
          runColor = this.modules[y][x];
          runX = 1;
        }
      }
      result += this.finderPenaltyTerminateAndCount(runColor, runX, runHistory) * QrCode.PENALTY_N3;
    }

    // Penalty for runs in each column.
    for (let x = 0; x < this.size; x++) {
      let runColor = false;
      let runY = 0;
      const runHistory = [0, 0, 0, 0, 0, 0, 0];
      for (let y = 0; y < this.size; y++) {
        if (this.modules[y][x] == runColor) {
          runY++;
          if (runY == 5) result += QrCode.PENALTY_N1;
          else if (runY > 5) result++;
        } else {
          this.finderPenaltyAddHistory(runY, runHistory);
          if (!runColor) result += this.finderPenaltyCountPatterns(runHistory) * QrCode.PENALTY_N3;
          runColor = this.modules[y][x];
          runY = 1;
        }
      }
      result += this.finderPenaltyTerminateAndCount(runColor, runY, runHistory) * QrCode.PENALTY_N3;
    }

    // Penalty for 2x2 blocks of the same colour.
    for (let y = 0; y < this.size - 1; y++) {
      for (let x = 0; x < this.size - 1; x++) {
        const color = this.modules[y][x];
        if (color == this.modules[y][x + 1] && color == this.modules[y + 1][x] && color == this.modules[y + 1][x + 1])
          result += QrCode.PENALTY_N2;
      }
    }

    // Penalty for an imbalanced ratio of dark to light modules.
    let dark = 0;
    for (const rowArr of this.modules) dark = rowArr.reduce((sum, color) => sum + (color ? 1 : 0), dark);
    const total = this.size * this.size;
    const k = Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1;
    result += k * QrCode.PENALTY_N4;
    return result;
  }

  // Returns the centre coordinates of the alignment patterns for this version.
  private getAlignmentPatternPositions(): number[] {
    if (this.version == 1) return [];
    const numAlign = Math.floor(this.version / 7) + 2;
    const step = this.version == 32 ? 26 : Math.ceil((this.version * 4 + 4) / (numAlign * 2 - 2)) * 2;
    const result: number[] = [6];
    for (let pos = this.size - 7; result.length < numAlign; pos -= step) result.splice(1, 0, pos);
    return result;
  }

  // The number of data bits available before error correction at a given version.
  private static getNumRawDataModules(ver: number): number {
    if (ver < QrCode.MIN_VERSION || ver > QrCode.MAX_VERSION) throw new RangeError("Version number out of range");
    let result = (16 * ver + 128) * ver + 64;
    if (ver >= 2) {
      const numAlign = Math.floor(ver / 7) + 2;
      result -= (25 * numAlign - 10) * numAlign - 55;
      if (ver >= 7) result -= 36;
    }
    return result;
  }

  // The number of 8-bit data codewords (excluding error correction) at a given version and level.
  private static getNumDataCodewords(ver: number, ecl: Ecc): number {
    return (
      Math.floor(QrCode.getNumRawDataModules(ver) / 8) -
      QrCode.ECC_CODEWORDS_PER_BLOCK[ecl.ordinal][ver] * QrCode.NUM_ERROR_CORRECTION_BLOCKS[ecl.ordinal][ver]
    );
  }

  // Builds the Reed-Solomon generator polynomial divisor of the given degree.
  private static reedSolomonComputeDivisor(degree: number): number[] {
    if (degree < 1 || degree > 255) throw new RangeError("Degree out of range");
    const result: number[] = [];
    for (let i = 0; i < degree - 1; i++) result.push(0);
    result.push(1); // The monic polynomial starts as x^0.

    let root = 1;
    for (let i = 0; i < degree; i++) {
      // Multiply the current product by (x - r^i).
      for (let j = 0; j < result.length; j++) {
        result[j] = QrCode.reedSolomonMultiply(result[j], root);
        if (j + 1 < result.length) result[j] ^= result[j + 1];
      }
      root = QrCode.reedSolomonMultiply(root, 0x02);
    }
    return result;
  }

  // Returns the Reed-Solomon remainder of `data` divided by `divisor`.
  private static reedSolomonComputeRemainder(data: readonly number[], divisor: readonly number[]): number[] {
    const result: number[] = divisor.map(() => 0);
    for (const b of data) {
      const factor = b ^ (result.shift() as number);
      result.push(0);
      divisor.forEach((coef, i) => (result[i] ^= QrCode.reedSolomonMultiply(coef, factor)));
    }
    return result;
  }

  // Multiplies two GF(2^8) field elements using the QR code's reducing polynomial 0x11D.
  private static reedSolomonMultiply(x: number, y: number): number {
    if (x >>> 8 != 0 || y >>> 8 != 0) throw new RangeError("Byte out of range");
    let z = 0;
    for (let i = 7; i >= 0; i--) {
      z = (z << 1) ^ ((z >>> 7) * 0x11d);
      z ^= ((y >>> i) & 1) * x;
    }
    return z;
  }

  // Counts finder-like patterns (1:1:3:1:1 ratio) recorded in the run history.
  private finderPenaltyCountPatterns(runHistory: readonly number[]): number {
    const n = runHistory[1];
    const core = n > 0 && runHistory[2] == n && runHistory[3] == n * 3 && runHistory[4] == n && runHistory[5] == n;
    return (
      (core && runHistory[0] >= n * 4 && runHistory[6] >= n ? 1 : 0) +
      (core && runHistory[6] >= n * 4 && runHistory[0] >= n ? 1 : 0)
    );
  }

  // Terminates the current run, appends the light border, and counts finder patterns.
  private finderPenaltyTerminateAndCount(
    currentRunColor: boolean,
    currentRunLength: number,
    runHistory: number[],
  ): number {
    if (currentRunColor) {
      this.finderPenaltyAddHistory(currentRunLength, runHistory);
      currentRunLength = 0;
    }
    currentRunLength += this.size; // Add the light border to the final run.
    this.finderPenaltyAddHistory(currentRunLength, runHistory);
    return this.finderPenaltyCountPatterns(runHistory);
  }

  // Pushes a run length onto the seven-entry run history.
  private finderPenaltyAddHistory(currentRunLength: number, runHistory: number[]): void {
    if (runHistory[0] == 0) currentRunLength += this.size; // Add the light border to the first run.
    runHistory.pop();
    runHistory.unshift(currentRunLength);
  }
}
