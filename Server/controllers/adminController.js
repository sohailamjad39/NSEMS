import User from '../models/User.js';

// GET /api/admins
export const getAllAdmins = async (req, res) => {
  try {
    const admins = await User.find(
      { role: { $in: ["admin", "scanner"] } },
      { password: 0 }
    ).lean();
    return res.json({ success: true, admins });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/admins/register
export const registerAdmin = async (req, res) => {
  try {
    const { name, email, phone, password, role } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ success: false, message: "Name, email and password are required" });

    const exists = await User.findOne({ email });
    if (exists) return res.status(409).json({ success: false, message: "Email already exists" });

    const user = await User.create({
      name, email, phone, password,
      role: ["admin", "scanner"].includes(role) ? role : "admin",
    });
    return res.status(201).json({ success: true, message: "Admin created", id: user._id });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/admins/:id
export const updateAdmin = async (req, res) => {
  try {
    const { name, email, phone, role } = req.body;
    const update = {};
    if (name)  update.name  = name;
    if (email) update.email = email;
    if (phone) update.phone = phone;
    if (role && ["admin","scanner"].includes(role)) update.role = role;

    const admin = await User.findByIdAndUpdate(req.params.id, update, { new: true, select: "-password" });
    if (!admin) return res.status(404).json({ success: false, message: "Admin not found" });
    return res.json({ success: true, message: "Admin updated", admin });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/admins/:id
export const deleteAdmin = async (req, res) => {
  try {
    // Prevent self-deletion
    if (String(req.params.id) === String(req.user._id))
      return res.status(400).json({ success: false, message: "Cannot delete your own account" });

    const admin = await User.findByIdAndDelete(req.params.id);
    if (!admin) return res.status(404).json({ success: false, message: "Admin not found" });
    return res.json({ success: true, message: "Admin deleted" });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};