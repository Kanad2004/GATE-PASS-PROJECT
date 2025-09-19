const nodemailer = require("nodemailer");
const QRCodeLib = require("qrcode");
const { ApiError } = require("../utils/ApiError");
const { ApiResponse } = require("../utils/ApiResponse");
const User = require("../models/User");
const QRCode = require("../models/QRCode");
const OTP = require("../models/Otp");
const PDFDocument = require("pdfkit");
const { format } = require("date-fns");

const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const createTransporter = () => {
  const emailUser = process.env.EMAIL_USER;
  const emailPass = process.env.EMAIL_PASS;

  if (!emailUser || !emailPass) {
    throw new ApiError(
      500,
      "Email credentials are missing in environment variables"
    );
  }

  const transporter = nodemailer.createTransport({
    host: "smtp-relay.brevo.com",
    port: 587, // Changed from 465 to 587
    secure: false, // Changed from true to false for port 587
    requireTLS: true, // Add this for security
    connectionTimeout: 60000, // 60 seconds timeout
    greetingTimeout: 30000, // 30 seconds greeting timeout
    socketTimeout: 75000, // 75 seconds socket timeout
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    // Add these retry and pool options
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
    rateLimit: 14, // messages per second (Brevo limit)
  });

  // Enhanced verification with better error handling
  transporter.verify((error, success) => {
    if (error) {
      console.error("Nodemailer configuration error:", error);
      console.error("Error details:", {
        code: error.code,
        command: error.command,
        response: error.response,
      });
    } else {
      console.log("Nodemailer is ready to send emails");
    }
  });

  return transporter;
};

const transporter = createTransporter();

const user_register = {
  create_otp: async (email) => {
    const otp = generateOTP();
    try {
      await OTP.create({ email, otp });
      return otp;
    } catch (error) {
      console.error("Error saving OTP:", error);
      throw new ApiError(500, "Failed to generate OTP");
    }
  },

  sendOtp: async (req, res) => {
    const { email, name, mobileNumber, purpose, visitDateAndTime } = req.body;
    if (!email || !name || !mobileNumber || !purpose || !visitDateAndTime) {
      throw new ApiError(400, "All fields are required");
    }

    try {
      if (!/^\d{10}$/.test(mobileNumber)) {
        throw new ApiError(400, "Mobile number must be 10 digits");
      }
      const visitDate = new Date(visitDateAndTime);
      if (isNaN(visitDate.getTime())) {
        throw new ApiError(400, "Invalid visit date and time");
      }
      const hours = visitDate.getHours();
      // if (hours < 9 || hours >= 18) {
      //   throw new ApiError(400, "Visits allowed between 9 AM and 6 PM");
      // }

      const otp = await user_register.create_otp(email);
      const mailOptions = {
        from: `"GatePass System" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "Your One-Time Password (OTP)",
        text: `Hello,\n\nYour OTP is: ${otp}. It is valid for 10 minutes.\n\nRegards,\nGatePass System`,
        html: `<p>Hello,</p><p>Your OTP is: <b>${otp}</b>. It is valid for 10 minutes.</p><p>Regards,<br>GatePass System</p>`,
      };

      await transporter.sendMail(mailOptions);
      return res
        .status(200)
        .json(new ApiResponse(200, { otp }, "OTP sent successfully"));
    } catch (error) {
      console.error("Error sending OTP:", error);
      throw error instanceof ApiError
        ? error
        : new ApiError(500, `Failed to send OTP: ${error.message}`);
    }
  },
};

const user_verification = {
  verify_otp: async (email, otp) => {
    if (!email || !otp) {
      throw new ApiError(400, "Email and OTP are required");
    }
    try {
      const storedOTP = await OTP.findOne({ email, otp });
      if (!storedOTP) {
        throw new ApiError(400, "Invalid or expired OTP");
      }
      await OTP.deleteOne({ email, otp });
      return true;
    } catch (error) {
      console.error("Error verifying OTP:", error);
      throw error instanceof ApiError
        ? error
        : new ApiError(400, "Verification failed");
    }
  },

  register_visitor: async ({
    name,
    email,
    mobileNumber,
    purpose,
    visitDateAndTime,
  }) => {
    try {
      let user = await User.findOne({ email });
      if (user) {
        user.name = name;
        user.mobileNumber = mobileNumber;
        user.purpose = purpose;
        user.visitDateAndTime = visitDateAndTime;
        user.isVerified = false;
        user.status = "pending";
        await user.save();
      } else {
        user = await User.create({
          email,
          name,
          mobileNumber,
          purpose,
          visitDateAndTime,
          isVerified: false,
          status: "pending",
        });
      }
      if (!user) {
        throw new ApiError(404, "User not found");
      }

      user.name = name;
      user.mobileNumber = mobileNumber;
      user.purpose = purpose;
      user.visitDateAndTime = visitDateAndTime;
      user.isVerified = true;
      user.status = "pending";
      await user.save();

      return { user };
    } catch (error) {
      console.error("Error updating visitor:", error);
      throw error instanceof ApiError
        ? error
        : new ApiError(500, "Failed to update visitor");
    }
  },

  verifyOtpAndRegister: async (req, res) => {
    const { email, otp, name, mobileNumber, purpose, visitDateAndTime } =
      req.body;

    if (
      !email ||
      !otp ||
      !name ||
      !mobileNumber ||
      !purpose ||
      !visitDateAndTime
    ) {
      throw new ApiError(400, "All fields are required");
    }

    const visitDate = new Date(visitDateAndTime);
    if (isNaN(visitDate.getTime())) {
      throw new ApiError(400, "Invalid visit date and time");
    }

    const result = await user_verification.verify_otp(email, otp);
    console.log("Result of OTP verification:", result);

    console.log("Registering visitor with details:", {
      name,
      email,
      mobileNumber,
      purpose,
      visitDateAndTime,
    });

    const visitor = await user_verification.register_visitor({
      name,
      email,
      mobileNumber,
      purpose,
      visitDateAndTime,
    });

    return res
      .status(201)
      .json(new ApiResponse(201, visitor, "Visitor request submitted"));
  },

  getRequests: async (req, res) => {
    try {
      const requests = await User.find({ status: "pending" }).select(
        "name email mobileNumber purpose visitDateAndTime status"
      );
      return res
        .status(200)
        .json(
          new ApiResponse(200, { requests }, "Requests fetched successfully")
        );
    } catch (error) {
      console.error("Error fetching requests:", error);
      throw new ApiError(500, "Failed to fetch requests");
    }
  },

  acceptRequest: async (req, res) => {
    const { requestId } = req.body;
    if (!requestId) {
      throw new ApiError(400, "Request ID is required");
    }

    try {
      const user = await User.findById(requestId);
      if (!user) {
        throw new ApiError(404, "User not found");
      }
      if (user.status !== "pending") {
        throw new ApiError(400, "Request is not pending");
      }

      user.status = "approved";
      await user.save();

      const qrCode = await QRCode.generateQRCode(user._id);
      let qrCodeImage;
      try {
        qrCodeImage = await QRCodeLib.toDataURL(qrCode.qrString, {
          errorCorrectionLevel: "H",
          type: "image/png",
          margin: 1,
        });
        console.log(`QR code image generated: ${qrCodeImage.slice(0, 50)}...`);
      } catch (error) {
        console.error("Failed to generate QR code image:", error);
        throw new ApiError(500, "Failed to generate QR code image");
      }

      let qrCodeBuffer;
      try {
        qrCodeBuffer = await QRCodeLib.toBuffer(qrCode.qrString, {
          errorCorrectionLevel: "H",
          type: "image/png",
          margin: 1,
        });
      } catch (error) {
        console.error("Failed to generate QR code buffer:", error);
        throw new ApiError(500, "Failed to generate QR code attachment");
      }

      const mailOptions = {
        from: `"GatePass System" <${process.env.EMAIL_USER}>`,
        to: user.email,
        subject: "Your GatePass QR Code",
        text: `Hello ${
          user.name
        },\n\nYour visitor request has been approved! Please use the attached QR code for entry.\n\nVisit Date & Time: ${user.visitDateAndTime.toLocaleString()}\nPurpose: ${
          user.purpose
        }\n\nRegards,\nGatePass System`,
        html: `
          <p>Hello ${user.name},</p>
          <p>Your visitor request has been approved! Please use the QR code below for entry:</p>
          <img src="cid:qrcode" alt="QR Code" />
          <p><strong>Visit Date & Time:</strong> ${user.visitDateAndTime.toLocaleString()}</p>
          <p><strong>Purpose:</strong> ${user.purpose}</p>
          <p>Regards,<br>GatePass System</p>
        `,
        attachments: [
          {
            filename: "qrcode.png",
            content: qrCodeBuffer,
            cid: "qrcode",
          },
        ],
      };

      await transporter.sendMail(mailOptions);
      console.log(`QR code email sent to ${user.email}`);

      return res
        .status(200)
        .json(new ApiResponse(200, {}, "Request approved and QR code sent"));
    } catch (error) {
      console.error("Error accepting request:", error);
      throw error instanceof ApiError
        ? error
        : new ApiError(500, "Failed to accept request");
    }
  },

  rejectRequest: async (req, res) => {
    const { requestId } = req.body;
    if (!requestId) {
      throw new ApiError(400, "Request ID is required");
    }

    try {
      const user = await User.findById(requestId);
      if (!user) {
        throw new ApiError(404, "User not found");
      }
      if (user.status !== "pending") {
        throw new ApiError(400, "Request is not pending");
      }

      user.status = "rejected";
      await user.save();

      const mailOptions = {
        from: `"GatePass System" <${process.env.EMAIL_USER}>`,
        to: user.email,
        subject: "GatePass Request Status",
        text: `Hello ${user.name},\n\nYour visitor request has been rejected.\n\nRegards,\nGatePass System`,
        html: `<p>Hello ${user.name},</p><p>Your visitor request has been rejected.</p><p>Regards,<br>GatePass System</p>`,
      };

      await transporter.sendMail(mailOptions);

      await User.deleteOne({ _id: requestId });

      return res.status(200).json(new ApiResponse(200, {}, "Request rejected"));
    } catch (error) {
      console.error("Error rejecting request:", error);
      throw error instanceof ApiError
        ? error
        : new ApiError(500, "Failed to reject request");
    }
  },

  scanQr: async (req, res) => {
    const { qrString } = req.body;
    if (!qrString) {
      throw new ApiError(400, "QR string is required");
    }

    try {
      const qrCode = await QRCode.findOne({ qrString, isActive: true });
      if (!qrCode) {
        throw new ApiError(400, "Invalid or expired QR code");
      }

      const user = await User.findById(qrCode.userId);
      if (!user || user.status !== "approved") {
        throw new ApiError(400, "User not approved or not found");
      }

      const currentTime = new Date();
      const qrExpirationTime = new Date(
        qrCode.createdAt.getTime() + 24 * 60 * 60 * 1000
      ); // 24 hours from creation

      if (!user.isVisited) {
        // Log entry
        console.log(`User ${user.name} is visiting at ${currentTime}`);
        user.entries.push({ entryTime: currentTime });
        user.isVisited = true;
        await user.save();

        return res.status(200).json(
          new ApiResponse(
            200,
            {
              user: { name: user.name, email: user.email },
              entryTime: user.entries[user.entries.length - 1].entryTime,
            },
            "Entry logged successfully"
          )
        );
      } else {
        // Log exit
        if (user.entries.length === 0) {
          throw new ApiError(500, "No entry found for exit");
        }

        const lastEntry = user.entries[user.entries.length - 1];
        if (lastEntry.exitTime) {
          throw new ApiError(400, "Exit already logged for this visit");
        }

        lastEntry.exitTime = currentTime;
        user.isVisited = false; // Allow future visits
        await user.save();

        return res.status(200).json(
          new ApiResponse(
            200,
            {
              user: { name: user.name, email: user.email },
              exitTime: lastEntry.exitTime,
            },
            "Exit logged successfully"
          )
        );
      }
    } catch (error) {
      console.error("Error scanning QR code:", error);
      throw error instanceof ApiError
        ? error
        : new ApiError(500, "Failed to scan QR code");
    }
  },

  downloadLog: async (req, res) => {
    const { startDate, endDate, status, search } = req.query;

    if (!startDate || !endDate) {
      throw new ApiError(400, "Start date and end date are required");
    }

    let doc;
    try {
      // Parse and validate dates
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999); // Include full end date

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        throw new ApiError(400, "Invalid date format");
      }

      if (start > end) {
        throw new ApiError(400, "Start date cannot be after end date");
      }

      // **Build dynamic query based on filters**
      let query = {};

      // Date range filter - check both visit date and entry dates
      const dateFilter = {
        $or: [
          { visitDateAndTime: { $gte: start, $lte: end } },
          { "entries.entryTime": { $gte: start, $lte: end } },
        ],
      };

      // Status filtering
      switch (status) {
        case "completed":
          // Users with both entry and exit
          query = {
            ...dateFilter,
            entries: {
              $elemMatch: {
                entryTime: { $exists: true },
                exitTime: { $exists: true },
              },
            },
          };
          break;
        case "inside":
          // Users with entry but no exit
          query = {
            ...dateFilter,
            entries: {
              $elemMatch: {
                entryTime: { $exists: true },
                exitTime: { $exists: false },
              },
            },
          };
          break;
        case "scheduled":
          // Users with scheduled visits but no entries
          query = {
            ...dateFilter,
            entries: { $size: 0 },
            status: "approved",
          };
          break;
        case "all":
        default:
          query = dateFilter;
          break;
      }

      // **Search functionality across multiple fields**
      if (search && search.trim()) {
        const searchTerm = search.trim();
        const searchRegex = new RegExp(searchTerm, "i"); // Case-insensitive

        query.$and = query.$and || [];
        query.$and.push({
          $or: [
            { name: searchRegex },
            { email: searchRegex },
            { purpose: searchRegex },
            { mobileNumber: searchRegex },
          ],
        });
      }

      // **Fetch users with enhanced selection**
      const users = await User.find(query)
        .select(
          "name email mobileNumber purpose visitDateAndTime entries status createdAt"
        )
        .sort({ visitDateAndTime: 1 });

      // **Transform data for better reporting**
      const reportData = [];

      users.forEach((user) => {
        if (user.entries && user.entries.length > 0) {
          // Users with actual visits
          user.entries.forEach((entry) => {
            // Filter entries within date range
            const entryInRange =
              entry.entryTime >= start && entry.entryTime <= end;
            const visitInRange =
              user.visitDateAndTime >= start && user.visitDateAndTime <= end;

            if (entryInRange || visitInRange) {
              reportData.push({
                name: user.name,
                email: user.email,
                mobileNumber: user.mobileNumber,
                purpose: user.purpose,
                visitDateAndTime: user.visitDateAndTime,
                entryTime: entry.entryTime,
                exitTime: entry.exitTime || null,
                status: entry.exitTime ? "Completed" : "Inside",
                duration: entry.exitTime
                  ? Math.round((entry.exitTime - entry.entryTime) / (1000 * 60))
                  : null, // Duration in minutes
              });
            }
          });
        } else if (
          user.visitDateAndTime >= start &&
          user.visitDateAndTime <= end
        ) {
          // Scheduled users without visits
          reportData.push({
            name: user.name,
            email: user.email,
            mobileNumber: user.mobileNumber,
            purpose: user.purpose,
            visitDateAndTime: user.visitDateAndTime,
            entryTime: null,
            exitTime: null,
            status: user.status === "approved" ? "Scheduled" : user.status,
            duration: null,
          });
        }
      });

      // Sort by visit date, then entry time
      reportData.sort((a, b) => {
        const aDate = a.visitDateAndTime;
        const bDate = b.visitDateAndTime;
        if (aDate.getTime() !== bDate.getTime()) {
          return aDate - bDate;
        }
        if (a.entryTime && b.entryTime) {
          return a.entryTime - b.entryTime;
        }
        return 0;
      });

      // **Generate Enhanced PDF**
      doc = new PDFDocument({
        size: "A4",
        margin: 40,
        info: {
          Title: `Visitor Report - ${format(start, "MMM d, yyyy")} to ${format(
            end,
            "MMM d, yyyy"
          )}`,
          Author: "GatePass System",
        },
        bufferPages: true,
      });

      // Set headers and pipe PDF to response
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=visitor-report-${startDate}-to-${endDate}.pdf`
      );
      doc.pipe(res);

      // **Enhanced PDF Design**
      const colors = {
        primary: "#2c3e50",
        secondary: "#3498db",
        success: "#27ae60",
        warning: "#f39c12",
        danger: "#e74c3c",
        header: "#f8f9fa",
        border: "#bdc3c7",
        text: "#333333",
        subtext: "#666666",
      };

      // Header function
      const drawHeader = () => {
        doc.rect(0, 0, doc.page.width, 80).fill(colors.primary);

        doc
          .circle(60, 40, 20)
          .lineWidth(2)
          .stroke(colors.header)
          .fillAndStroke(colors.secondary, colors.header);

        doc
          .fontSize(22)
          .font("Helvetica-Bold")
          .fillColor("#FFFFFF")
          .text("GatePass System", 95, 25);

        doc
          .fontSize(14)
          .font("Helvetica")
          .fillColor("#FFFFFF")
          .text(
            `Visitor Report - ${format(start, "MMM d, yyyy")} to ${format(
              end,
              "MMM d, yyyy"
            )}`,
            95,
            50
          );

        doc
          .moveTo(40, 90)
          .lineTo(doc.page.width - 40, 90)
          .strokeColor(colors.secondary)
          .lineWidth(2)
          .stroke();
      };

      // Footer function
      const drawFooter = (pageNumber, totalPages) => {
        const footerTop = doc.page.height - 50;
        doc
          .moveTo(40, footerTop)
          .lineTo(doc.page.width - 40, footerTop)
          .strokeColor(colors.border)
          .lineWidth(0.5)
          .stroke();

        doc
          .fontSize(8)
          .font("Helvetica")
          .fillColor(colors.subtext)
          .text(
            `Generated on ${format(new Date(), "MMM d, yyyy 'at' h:mm a")}`,
            40,
            footerTop + 10,
            { align: "left" }
          )
          .text(
            `Page ${pageNumber} of ${totalPages}`,
            doc.page.width - 40,
            footerTop + 10,
            { align: "right" }
          );
      };

      // Start first page
      drawHeader();

      // **Enhanced Summary with Filter Info**
      const summaryTop = 110;
      doc
        .roundedRect(40, summaryTop, doc.page.width - 80, 100, 5)
        .fillAndStroke("#f2f9ff", colors.border);

      doc
        .fontSize(12)
        .font("Helvetica-Bold")
        .fillColor(colors.primary)
        .text("Report Summary", 50, summaryTop + 10);

      // Calculate statistics
      const totalVisitors = reportData.length;
      const completedVisits = reportData.filter(
        (r) => r.status === "Completed"
      ).length;
      const currentlyInside = reportData.filter(
        (r) => r.status === "Inside"
      ).length;
      const scheduledOnly = reportData.filter(
        (r) => r.status === "Scheduled"
      ).length;

      doc.fontSize(10).font("Helvetica").fillColor(colors.text);

      // Left column
      doc
        .text(`Total Records: ${totalVisitors}`, 50, summaryTop + 35)
        .text(
          `Date Range: ${format(start, "MMM d, yyyy")} to ${format(
            end,
            "MMM d, yyyy"
          )}`,
          50,
          summaryTop + 50
        )
        .text(
          `Filter Applied: ${
            status === "all"
              ? "All Status"
              : status.charAt(0).toUpperCase() + status.slice(1)
          }`,
          50,
          summaryTop + 65
        );

      // Right column
      doc
        .text(`Completed Visits: ${completedVisits}`, 300, summaryTop + 35)
        .text(`Currently Inside: ${currentlyInside}`, 300, summaryTop + 50)
        .text(`Scheduled Only: ${scheduledOnly}`, 300, summaryTop + 65);

      if (search && search.trim()) {
        doc.text(`Search Term: "${search.trim()}"`, 50, summaryTop + 80);
      }

      // **Enhanced Table with Status Colors and Duration**
      const tableTop = summaryTop + 120;
      const colWidths = [80, 100, 60, 70, 70, 70, 60, 50];
      const headers = [
        "Name",
        "Email",
        "Mobile",
        "Purpose",
        "Visit Date",
        "Entry Time",
        "Exit Time",
        "Status",
      ];
      const baseRowHeight = 25;
      const padding = 4;

      const tableWidth = colWidths.reduce((sum, width) => sum + width, 0);
      const tableX = (doc.page.width - tableWidth) / 2;

      // Table header
      doc
        .rect(tableX, tableTop, tableWidth, baseRowHeight)
        .fill(colors.secondary);
      doc.fontSize(9).font("Helvetica-Bold").fillColor("#FFFFFF");

      let x = tableX;
      headers.forEach((header, i) => {
        doc.text(header, x + padding, tableTop + padding, {
          width: colWidths[i] - padding * 2,
          align: i >= 4 ? "center" : "left",
        });
        x += colWidths[i];
      });

      // Table rows with status-based coloring
      let y = tableTop + baseRowHeight;
      doc.fontSize(8).font("Helvetica");

      reportData.forEach((row, index) => {
        // Calculate row height for wrapped text
        const maxLines = Math.max(
          Math.ceil(
            doc.widthOfString(row.name || "") / (colWidths[0] - padding * 2)
          ),
          Math.ceil(
            doc.widthOfString(row.purpose || "") / (colWidths[3] - padding * 2)
          ),
          1
        );
        const dynamicRowHeight = Math.max(
          baseRowHeight,
          10 * maxLines + padding * 2
        );

        // Alternating row background
        doc
          .rect(tableX, y, tableWidth, dynamicRowHeight)
          .fill(index % 2 === 0 ? "#f9f9f9" : "#ffffff");

        // Row data with proper formatting
        const visitDate = row.visitDateAndTime
          ? format(new Date(row.visitDateAndTime), "MMM d")
          : "-";
        const entryTime = row.entryTime
          ? format(new Date(row.entryTime), "h:mm a")
          : "-";
        const exitTime = row.exitTime
          ? format(new Date(row.exitTime), "h:mm a")
          : "-";

        const rowData = [
          row.name || "",
          row.email || "",
          row.mobileNumber || "",
          row.purpose || "",
          visitDate,
          entryTime,
          exitTime,
          row.status || "Unknown",
        ];

        // Draw cell content with status-based colors
        x = tableX;
        rowData.forEach((cell, i) => {
          let textColor = colors.text;

          // Status-based coloring
          if (i === 7) {
            // Status column
            switch (row.status) {
              case "Completed":
                textColor = colors.success;
                break;
              case "Inside":
                textColor = colors.warning;
                break;
              case "Scheduled":
                textColor = colors.secondary;
                break;
              default:
                textColor = colors.text;
            }
          }

          doc.fillColor(textColor);
          doc.text(cell, x + padding, y + padding, {
            width: colWidths[i] - padding * 2,
            align: i >= 4 ? "center" : "left",
          });
          x += colWidths[i];
        });

        // Draw borders
        doc.strokeColor(colors.border).lineWidth(0.5);
        x = tableX;
        for (let i = 0; i <= headers.length; i++) {
          doc
            .moveTo(x, y)
            .lineTo(x, y + dynamicRowHeight)
            .stroke();
          x += colWidths[i] || 0;
        }
        doc
          .moveTo(tableX, y + dynamicRowHeight)
          .lineTo(tableX + tableWidth, y + dynamicRowHeight)
          .stroke();

        y += dynamicRowHeight;

        // Page break handling
        if (y > doc.page.height - 80) {
          drawFooter(doc.bufferedPageRange().start + 1, "?");
          doc.addPage();
          drawHeader();

          // Redraw table header
          doc
            .rect(tableX, tableTop, tableWidth, baseRowHeight)
            .fill(colors.secondary);
          doc.fontSize(9).font("Helvetica-Bold").fillColor("#FFFFFF");
          x = tableX;
          headers.forEach((header, i) => {
            doc.text(header, x + padding, tableTop + padding, {
              width: colWidths[i] - padding * 2,
              align: i >= 4 ? "center" : "left",
            });
            x += colWidths[i];
          });
          y = tableTop + baseRowHeight;
          doc.fontSize(8).font("Helvetica");
        }
      });

      // No data message
      if (reportData.length === 0) {
        doc
          .fontSize(12)
          .font("Helvetica")
          .fillColor(colors.subtext)
          .text(
            "No records found matching the selected criteria.",
            40,
            tableTop + 40,
            {
              align: "center",
              width: doc.page.width - 80,
            }
          );
      }

      // Insert page numbers on all pages
      const range = doc.bufferedPageRange();
      for (let i = 0; i < range.count; i++) {
        doc.switchToPage(i);
        drawFooter(i + 1, range.count);
      }

      doc.end();
    } catch (error) {
      console.error("Error generating visitor report:", error);
      if (!res.headersSent) {
        res
          .status(500)
          .json(new ApiError(500, "Failed to generate visitor report"));
      }
      if (doc) doc.end();
    }
  },
};

module.exports = { user_register, user_verification };
