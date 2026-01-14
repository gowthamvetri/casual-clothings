import Contact from '../models/contact.model.js';
import sendEmail from '../config/sendEmail.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Submit a contact message
export const submitContactMessage = async (req, res) => {
  try {
    const { fullName, email, subject, message } = req.body;

    // Validate input
    if (!fullName || !email || !subject || !message) {
      return res.status(400).json({ 
        success: false,
        message: 'Please provide all required fields'
      });
    }

    // Create new contact request in database
    const contact = new Contact({
      fullName,
      email,
      subject,
      message
    });

    await contact.save();

    // Send confirmation email to user
    sendEmail({
      sendTo: email,
      subject: 'Thank you for contacting Casual Clothing Fashion',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
          <h2 style="color: #333; border-bottom: 1px solid #eee; padding-bottom: 10px;">Thank You for Contacting Us</h2>
          <p>Hello ${fullName},</p>
          <p>We have received your message regarding: <strong>${subject}</strong></p>
          <p>Our team will review your inquiry and get back to you as soon as possible.</p>
          <p>Thank you for your interest in Casual Clothing Fashion.</p>
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #777; font-size: 12px;">
            <p>This is an automated email. Please do not reply to this message.</p>
          </div>
        </div>
      `
    });

    // Send notification email to admin
    sendEmail({
      sendTo: process.env.ADMIN_EMAIL || process.env.EMAIL_USER,
      subject: 'New Contact Form Submission',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
          <h2 style="color: #333; border-bottom: 1px solid #eee; padding-bottom: 10px;">New Contact Form Submission</h2>
          <p><strong>Name:</strong> ${fullName}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Subject:</strong> ${subject}</p>
          <p><strong>Message:</strong></p>
          <p style="background-color: #f9f9f9; padding: 15px; border-radius: 5px;">${message}</p>
        </div>
      `
    });

    return res.status(200).json({
      success: true,
      message: 'Your message has been sent successfully'
    });

  } catch (error) {
    console.error('Contact submission error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to send your message. Please try again later.'
    });
  }
};

// Get all contact messages
export const getAllContactMessages = async (req, res) => {
  try {
    const messages = await Contact.find().sort({ createdAt: -1 });
    return res.status(200).json({
      success: true,
      data: messages
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve contact messages'
    });
  }
};

// Update message status
export const updateMessageStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, priority } = req.body;

    // Check if status is valid
    if (status && !['pending', 'read', 'replied', 'resolved'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status value'
      });
    }

    // Check if priority is valid
    if (priority && !['low', 'medium', 'high', 'urgent'].includes(priority)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid priority value'
      });
    }

    // Create update object with only provided fields
    const updateData = {};
    if (status) updateData.status = status;
    if (priority) updateData.priority = priority;

    const updatedMessage = await Contact.findByIdAndUpdate(
      id, 
      updateData, 
      { new: true }
    );

    if (!updatedMessage) {
      return res.status(404).json({
        success: false,
        message: 'Contact message not found'
      });
    }

    return res.status(200).json({
      success: true,
      data: updatedMessage
    });

  } catch (error) {
    console.error('Update message status error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update message status'
    });
  }
};

// Add admin reply to message
export const addAdminReply = async (req, res) => {
  try {
    const { id } = req.params;
    const { message, sendToUser } = req.body;
    
    // Validate input
    if (!message) {
      return res.status(400).json({
        success: false,
        message: 'Reply message is required'
      });
    }

    const contactMessage = await Contact.findById(id);
    
    if (!contactMessage) {
      return res.status(404).json({
        success: false,
        message: 'Contact message not found'
      });
    }

    // Create new reply
    const newReply = {
      message,
      sentToUser: !!sendToUser,
      createdAt: new Date()
    };
    
    // Add reply to contact message
    contactMessage.adminReplies.push(newReply);
    
    // Update status to replied
    contactMessage.status = 'replied';
    
    await contactMessage.save();

    // Send email to user if sendToUser is true
    if (sendToUser) {
      sendEmail({
        sendTo: contactMessage.email,
        subject: `Re: ${contactMessage.subject}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
            <h2 style="color: #333; border-bottom: 1px solid #eee; padding-bottom: 10px;">Response to Your Inquiry</h2>
            <p>Hello ${contactMessage.fullName},</p>
            <p>Thank you for contacting Casual Clothing Fashion. We're responding to your message regarding: <strong>${contactMessage.subject}</strong></p>
            <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 15px 0;">
              ${message}
            </div>
            <p>If you have any further questions, please feel free to reply to this email.</p>
            <p>Best regards,<br>The Casual Clothing Fashion Team</p>
          </div>
        `
      });
    }

    return res.status(200).json({
      success: true,
      data: contactMessage
    });

  } catch (error) {
    console.error('Add admin reply error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to add admin reply'
    });
  }
};

// Add admin comment to message
export const addAdminComment = async (req, res) => {
  try {
    const { id } = req.params;
    const { text, isPublic, displayToUser } = req.body;
    
    // Validate input
    if (!text) {
      return res.status(400).json({
        success: false,
        message: 'Comment text is required'
      });
    }

    const contactMessage = await Contact.findById(id);
    
    if (!contactMessage) {
      return res.status(404).json({
        success: false,
        message: 'Contact message not found'
      });
    }

    // Create new comment
    const newComment = {
      text,
      isPublic: !!isPublic,
      displayToUser: !!displayToUser,
      createdAt: new Date()
    };
    
    // Add comment to contact message
    contactMessage.adminComments.push(newComment);
    
    await contactMessage.save();

    return res.status(200).json({
      success: true,
      data: contactMessage
    });

  } catch (error) {
    console.error('Add admin comment error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to add admin comment'
    });
  }
};

// Delete a message
export const deleteMessage = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedMessage = await Contact.findByIdAndDelete(id);

    if (!deletedMessage) {
      return res.status(404).json({
        success: false,
        message: 'Contact message not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Contact message deleted successfully'
    });

  } catch (error) {
    console.error('Delete message error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete contact message'
    });
  }
};

// Get contact history for logged-in user
export const getUserContactHistory = async (req, res) => {
  try {
    const userId = req.userId;
    
    // Get user's email from user model
    const user = await import('../models/users.model.js').then(module => module.default);
    const userData = await user.findById(userId);
    
    if (!userData) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Find contact messages by user's email
    const messages = await Contact.find({ 
      email: userData.email 
    }).sort({ createdAt: -1 });
    
    return res.status(200).json({
      success: true,
      data: messages
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve your contact history'
    });
  }
};