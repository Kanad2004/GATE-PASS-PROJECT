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
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: emailUser,
      pass: emailPass,
    },
  });

  transporter.verify((error, success) => {
    if (error) {
      console.error("Nodemailer configuration error:", error);
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
      if (hours < 9 || hours >= 18) {
        throw new ApiError(400, "Visits allowed between 9 AM and 6 PM");
      }

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
    const { date } = req.query;
    if (!date) {
      res.status(400).json(new ApiResponse(400, {}, "Date is required"));
      return;
    }

    let doc;
    try {
      const startDate = new Date(date);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 1);

      const users = await User.find({
        "entries.entryTime": { $gte: startDate, $lt: endDate },
      }).select("name email purpose visitDateAndTime entries");

      const logData = users
        .flatMap((user) =>
          user.entries
            .filter(
              (entry) =>
                entry.entryTime >= startDate && entry.entryTime < endDate
            )
            .map((entry) => ({
              name: user.name,
              email: user.email,
              purpose: user.purpose,
              visitDateAndTime: user.visitDateAndTime,
              entryTime: entry.entryTime,
              exitTime: entry.exitTime || "",
            }))
        )
        .sort((a, b) => a.entryTime - b.entryTime); // Sort by entry time

      // Create PDF with improved styling
      doc = new PDFDocument({
        size: "A4",
        margin: 40,
        info: {
          Title: `Daily Entry Log - ${format(new Date(date), "MMMM d, yyyy")}`,
          Author: "GatePass System",
        },
        bufferPages: true, // Enable page buffering for accurate page numbers
      });

      // Handle errors during PDF generation
      doc.on("error", (err) => {
        console.error("PDFDocument error:", err);
        if (!res.headersSent) {
          res
            .status(500)
            .json(new ApiResponse(500, {}, "Failed to generate PDF log"));
        }
      });

      // Set headers and pipe the PDF to the response
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=entry-log-${date}.pdf`
      );
      doc.pipe(res);

      // Define colors for better visual design
      const colors = {
        primary: "#2c3e50", // Dark blue header
        secondary: "#3498db", // Light blue accents
        header: "#f8f9fa", // Light gray header background
        border: "#bdc3c7", // Light gray border
        text: "#333333", // Dark text
        subtext: "#666666", // Gray text for secondary info
      };

      // Function to draw header on each page with improved design
      const drawHeader = () => {
        // Add a colored header background
        doc.rect(0, 0, doc.page.width, 80).fill(colors.primary);

        // Add logo space (you can add a logo image here)
        doc
          .circle(60, 40, 20)
          .lineWidth(2)
          .stroke(colors.header)
          .fillAndStroke(colors.secondary, colors.header);

        // Draw the title text with improved formatting
        doc
          .fontSize(22)
          .font("Helvetica-Bold")
          .fillColor("#FFFFFF")
          .text("GatePass System", 95, 30);

        doc
          .fontSize(14)
          .font("Helvetica")
          .fillColor("#FFFFFF")
          .text(
            `Daily Entry Log - ${format(new Date(date), "MMMM d, yyyy")}`,
            95,
            55
          );

        // Add a decorative line
        doc
          .moveTo(40, 90)
          .lineTo(doc.page.width - 40, 90)
          .strokeColor(colors.secondary)
          .lineWidth(2)
          .stroke();

        // Add a subtle shadow line
        doc
          .moveTo(40, 92)
          .lineTo(doc.page.width - 40, 92)
          .strokeColor(colors.border)
          .lineWidth(0.5)
          .stroke();
      };

      // Function to draw footer on each page with improved design
      const drawFooter = (pageNumber) => {
        const footerTop = doc.page.height - 50;

        // Add a decorative line
        doc
          .moveTo(40, footerTop)
          .lineTo(doc.page.width - 40, footerTop)
          .strokeColor(colors.border)
          .lineWidth(0.5)
          .stroke();

        // Add footer text
        doc
          .fontSize(8)
          .font("Helvetica")
          .fillColor(colors.subtext)
          .text(
            `GatePass System © ${new Date().getFullYear()} | Generated on ${format(
              new Date(),
              "MMMM d, yyyy 'at' h:mm a"
            )}`,
            40,
            footerTop + 10,
            { align: "left" }
          );

        // Add page numbers
        doc
          .fontSize(8)
          .fillColor(colors.subtext)
          .text(
            `Page ${pageNumber} of ${doc.bufferedPageRange().count}`,
            doc.page.width - 40,
            footerTop + 10,
            { align: "right" }
          );
      };

      // Function to wrap text and calculate height
      const wrapText = (text, maxWidth, fontSize) => {
        doc.fontSize(fontSize).font("Helvetica");
        const words = text.toString().split(" ");
        let line = "";
        const lines = [];
        for (const word of words) {
          const testLine = line + (line ? " " : "") + word;
          const width = doc.widthOfString(testLine);
          if (width > maxWidth) {
            if (line) lines.push(line);
            line = word;
          } else {
            line = testLine;
          }
        }
        if (line) lines.push(line);
        return lines;
      };

      // Start the first page
      drawHeader();

      // Add summary statistics
      const summaryTop = 110;
      doc
        .roundedRect(40, summaryTop, doc.page.width - 80, 60, 5)
        .fillAndStroke("#f2f9ff", colors.border);

      doc
        .fontSize(12)
        .font("Helvetica-Bold")
        .fillColor(colors.primary)
        .text("Summary Information", 50, summaryTop + 10);

      doc
        .fontSize(10)
        .font("Helvetica")
        .fillColor(colors.text)
        .text(`Total Visitors: ${logData.length}`, 50, summaryTop + 30);

      // Calculate if any visitors are still inside (no exit time)
      const stillInside = logData.filter((entry) => !entry.exitTime).length;
      doc.text(`Visitors Still Inside: ${stillInside}`, 250, summaryTop + 30);

      // Table setup with improved styling and better sizing
      const tableTop = summaryTop + 80;
      const colWidths = [100, 130, 90, 75, 75, 85];
      const headers = [
        "Name",
        "Email",
        "Purpose",
        "Visit Date",
        "Entry Time",
        "Exit Time",
      ];
      const baseRowHeight = 25; // Base row height
      const padding = 6; // Cell padding

      // Make sure table fits on page width
      const tableWidth = colWidths.reduce((sum, width) => sum + width, 0);
      const tableX = (doc.page.width - tableWidth) / 2;

      // Draw table header background
      doc
        .rect(tableX, tableTop, tableWidth, baseRowHeight)
        .fill(colors.secondary);

      // Draw table headers with better styling
      doc.fontSize(10).font("Helvetica-Bold").fillColor("#FFFFFF");

      let x = tableX;
      headers.forEach((header, i) => {
        doc.text(header, x + padding, tableTop + padding, {
          width: colWidths[i] - padding * 2,
          align: i >= 3 ? "center" : "left", // Center align date/time columns
        });
        x += colWidths[i];
      });

      // Draw table rows with alternating background colors
      let y = tableTop + baseRowHeight;
      doc.fontSize(9).font("Helvetica");

      logData.forEach((row, index) => {
        // Format dates properly for better display
        const formattedVisitDate = format(
          new Date(row.visitDateAndTime),
          "MMM d, yyyy"
        );
        const formattedVisitTime = format(
          new Date(row.visitDateAndTime),
          "h:mm a"
        );
        const formattedEntryDate = format(
          new Date(row.entryTime),
          "MMM d, yyyy"
        );
        const formattedEntryTime = format(new Date(row.entryTime), "h:mm a");

        let formattedExitTime = "-";
        if (row.exitTime) {
          formattedExitTime = format(new Date(row.exitTime), "h:mm a");
        }

        const rowData = [
          row.name,
          row.email,
          row.purpose,
          `${formattedVisitDate}\n${formattedVisitTime}`,
          formattedEntryTime,
          formattedExitTime,
        ];

        // Calculate row height based on wrapped text
        let maxLines = 1;
        rowData.forEach((cell, i) => {
          const cellText = cell || "-";
          const lines = wrapText(cellText, colWidths[i] - padding * 2, 9);
          maxLines = Math.max(maxLines, lines.length);
        });
        const dynamicRowHeight = Math.max(
          baseRowHeight,
          12 * maxLines + padding * 2
        );

        // Draw alternating row background
        doc
          .rect(tableX, y, tableWidth, dynamicRowHeight)
          .fill(index % 2 === 0 ? "#f9f9f9" : "#ffffff");

        // Draw row content
        x = tableX;
        rowData.forEach((cell, i) => {
          // Highlight rows with no exit time
          if (i === 5 && cell === "-") {
            doc.fillColor("#e74c3c"); // Red color for missing exit time
          } else {
            doc.fillColor(colors.text);
          }

          const cellText = cell || "-";
          const lines = wrapText(cellText, colWidths[i] - padding * 2, 9);
          lines.forEach((line, lineIndex) => {
            doc.text(line, x + padding, y + padding + lineIndex * 12, {
              width: colWidths[i] - padding * 2,
              align: i >= 3 ? "center" : "left", // Center align date/time columns
            });
          });
          x += colWidths[i];
        });

        // Draw cell borders
        doc.strokeColor(colors.border).lineWidth(0.5);

        // Draw vertical lines
        x = tableX;
        for (let i = 0; i <= headers.length; i++) {
          doc
            .moveTo(x, y)
            .lineTo(x, y + dynamicRowHeight)
            .stroke();
          x += colWidths[i] || 0;
        }

        // Draw horizontal line below each row
        doc
          .moveTo(tableX, y + dynamicRowHeight)
          .lineTo(tableX + tableWidth, y + dynamicRowHeight)
          .stroke();

        y += dynamicRowHeight;

        // Handle page overflow
        if (y > doc.page.height - 70) {
          drawFooter(doc.bufferedPageRange().start + 1);
          doc.addPage();
          drawHeader();

          // Redraw table headers on new page
          doc
            .rect(tableX, tableTop, tableWidth, baseRowHeight)
            .fill(colors.secondary);

          doc.fontSize(10).font("Helvetica-Bold").fillColor("#FFFFFF");

          x = tableX;
          headers.forEach((header, i) => {
            doc.text(header, x + padding, tableTop + padding, {
              width: colWidths[i] - padding * 2,
              align: i >= 3 ? "center" : "left",
            });
            x += colWidths[i];
          });

          // Reset y position for new page
          y = tableTop + baseRowHeight;
          doc.fontSize(9).font("Helvetica");
        }
      });

      // If no entries found, show a message
      if (logData.length === 0) {
        doc
          .fontSize(12)
          .font("Helvetica") // Changed from Helvetica-Italic to Helvetica
          .fillColor(colors.subtext)
          .text("No entries found for this date.", 40, tableTop + 40, {
            align: "center",
            width: doc.page.width - 80,
          });
      }

      // Add notes section at bottom if space allows
      if (y < doc.page.height - 120) {
        const notesTop = y + 20;

        doc
          .roundedRect(40, notesTop, doc.page.width - 80, 60, 5)
          .fillAndStroke("#f9f9f9", colors.border);

        doc
          .fontSize(11)
          .font("Helvetica-Bold")
          .fillColor(colors.primary)
          .text("Notes", 50, notesTop + 10);

        doc
          .fontSize(9)
          .font("Helvetica")
          .fillColor(colors.subtext)
          .text(
            "This report was automatically generated by the GatePass System. For any discrepancies, please contact the system administrator.",
            50,
            notesTop + 30,
            {
              width: doc.page.width - 100,
            }
          );
      }

      // Insert page numbers and draw footers on all pages
      const range = doc.bufferedPageRange();
      for (let i = 0; i < range.count; i++) {
        doc.switchToPage(i);
        drawFooter(i + 1);
      }

      doc.end();
    } catch (error) {
      console.error("Error generating PDF log:", error);
      // Ensure we don't attempt to write to the response if headers are already sent
      if (!res.headersSent) {
        res
          .status(500)
          .json(new ApiResponse(500, {}, "Failed to generate PDF log"));
      } else {
        // If headers are sent, ensure the document is ended to prevent further writes
        doc?.end();
      }
    }
  },
};

module.exports = { user_register, user_verification };
