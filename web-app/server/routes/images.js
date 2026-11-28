const router = require("express").Router();
const sharp = require("sharp");
const { HomeImage } = require("../models");
const { auth, staff, id, z, fail } = require("../lib");
router.post("/", auth, staff, async (req, res) => {
  const { image } = z
    .object({ image: z.string().max(1500000) })
    .parse(req.body);
  const match =
    /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(image);
  if (!match) fail(400, "Upload a JPEG, PNG or WebP image");
  const input = Buffer.from(match[2], "base64");
  if (input.length > 1024 * 1024) fail(400, "Image must be at most 1 MB");
  let data;
  try {
    const decoder = sharp(input, { limitInputPixels: 16000000 });
    const metadata = await decoder.metadata();
    if (!["jpeg", "png", "webp"].includes(metadata.format)) throw new Error();
    data = await decoder
      .rotate()
      .resize({
        width: 1600,
        height: 1600,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 80 })
      .toBuffer();
  } catch {
    fail(400, "Invalid image or image exceeds 16 megapixels");
  }
  const stored = await HomeImage.create({ data, uploadedBy: req.user._id });
  res.status(201).json({ imageUrl: "/api/images/" + stored._id });
});
router.get("/:id", async (req, res) => {
  const image = await HomeImage.findById(id.parse(req.params.id));
  if (!image) fail(404, "Image not found");
  res
    .set("Cache-Control", "public, max-age=86400")
    .type("image/jpeg")
    .send(image.data);
});
module.exports = router;
