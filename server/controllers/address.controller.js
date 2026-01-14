import AddressModel from "../models/address.model.js";
import UserModel from "../models/users.model.js";

export const addAddressController = async (req, res) => {
    try {
        const userId = req.userId; // Assuming user ID is stored in req.user
        
        // Validate request body
        const { address_line, city, state, pincode, country, mobile, addIframe } = req.body;

        
        // Create a new address
        const newAddress = new AddressModel({
            address_line,
            city,
            state,
            pincode,
            country,
            mobile,
            userId: userId, // Associate the address with the user
            addIframe: addIframe || "",  
        });

        const savedAddress = await newAddress.save();
        
        const addAddressId = await UserModel.findByIdAndUpdate(userId,{
            $push: { 
                address_details: savedAddress._id 
            }
        });
        

        return res.status(201).json({
            message: "Address added successfully",
            success: true,
            address: savedAddress,
            data: savedAddress,
        });

    } catch (error) {
        return res.status(500).json({ 
            message: "Error adding address", 
            error: true,
            success: false,
            details: error.message 
        });
    }
};

export const getAddressController = async (req, res) => {
    try {
        const userId = req.userId; // Assuming user ID is stored in req.user
        // Fetch all addresses for the user
        const addresses = await AddressModel.find({ userId: userId }).sort({ createdAt: -1 });

        return res.status(200).json({
            message: "Addresses fetched successfully",
            success: true,
            addresses: addresses,
            data: addresses,
        });
    } catch (error) {
        return res.status(500).json({ 
            message: "Error fetching addresses", 
            error: true,
            success: false,
            details: error.message 
        });
    }
};

export const editAddressController = async (req, res) => {
    try {
        const userId = req.userId; // Assuming user ID is stored in req.user
        const { _id, address_line, city, state, pincode, country, mobile } = req.body;

        // Find the address by ID and update it
        const updatedAddress = await AddressModel.updateOne(
            { _id , userId: userId },
            { address_line, city, state, pincode, country, mobile }, 
        );

        return res.status(200).json({
            message: "Address updated successfully",
            success: true,
            error: false,
            data: updatedAddress,
        });
    } catch (error) {

        return res.status(500).json({ 
            message: "Error updating address", 
            error: true,
            success: false,
            details: error.message 
        });
    }
}


export const deleteAddressController = async (req, res) => {
    try {
        const userId = req.userId; // Assuming user ID is stored in req.user
        const { _id } = req.body;

        // Find the address by ID and delete it
        const disabledAddress = await AddressModel.updateOne({ _id: _id, userId: userId },{
            status : false
        });

        return res.status(200).json({
            message: "Address deleted successfully",
            error: false,
            success: true,
            data: disabledAddress,
        });
    } catch (error) {
        return res.status(500).json({ 
            message: "Error deleting address", 
            error: true,
            success: false,
            details: error.message 
        });
    }
};

