export const PERSONAL_INFO_FIELDS = [
  {
    name: "fullName",
    label: "Full Name",
    type: "text",
    required: true,
    placeholder: "Enter your full name"
  },
  {
    name: "age",
    label: "Age",
    type: "number",
    required: true,
    placeholder: "Enter your age",
    min: 1,
    max: 25
  },
  {
    name: "category",
    label: "Category",
    type: "select",
    required: true,
    options: [
      { value: "", label: "Select Category" },
      { value: "toddler", label: "Toddler (1-5 years)" },
      { value: "children_6_8", label: "Children (6-8 years)" },
      { value: "pre_teens", label: "Pre-Teens (9-12 years)" },
      { value: "teens", label: "Teens (13-19 years)" },
      { value: "super_teens", label: "Super Teens" },
      { value: "alumni", label: "Alumni" },
      { value: "teacher", label: "Teacher/Volunteer" }
    ]
  },
  {
    name: "gender",
    label: "Gender",
    type: "select",
    required: true,
    options: [
      { value: "", label: "Select Gender" },
      { value: "male", label: "Male" },
      { value: "female", label: "Female" }
    ]
  },
  {
    name: "phone",
    label: "Phone Number", 
    type: "tel",
    required: true,
    placeholder: "+234 800 123 4567"
  },
  {
    name: "email",
    label: "Email Address",
    type: "email",
    required: true,
    placeholder: "your.email@example.com"
  }
];

export const CHURCH_INFO_FIELDS = [
  {
    name: "province",
    label: "Province",
    type: "select",
    required: true,
    options: [
      { value: "lagos_province_9", label: "Lagos Province 9" },
      { value: "lagos_province_28", label: "Lagos Province 28" },
      { value: "lagos_province_69", label: "Lagos Province 69" },
      { value: "lagos_province_84", label: "Lagos Province 84" },
      { value: "lagos_province_86", label: "Lagos Province 86" },
      { value: "lagos_province_104", label: "Lagos Province 104" },
      { value: "regional_hq", label: "Regional Headquarter" },
    ]
  },
  {
    name: "zone",
    label: "Zone",
    type: "text",
    required: true,
    placeholder: "Enter your zone"
  },
  {
    name: "area",
    label: "Area",
    type: "text",
    required: true,
    placeholder: "Enter your area"
  },
  {
    name: "parish",
    label: "Parish/Local Church",
    type: "text",
    required: true,
    placeholder: "e.g., RCCG Jesus Palace Parish"
  },
  {
    name: "department",
    label: "Church Department",
    type: "select",
    required: false,
    options: [
      { value: "", label: "Select Department" },
      { value: "teens_church", label: "Teens Church" },
      { value: "children_church", label: "Children Church" },
      { value: "executive", label: "Executive" },
      { value: "none", label: "Not in any department" }
    ]
  }
];

export const MEDICAL_INFO_FIELDS = [
  {
    name: "medicalConditions",
    label: "Any Medical Conditions or Allergies?",
    type: "textarea",
    required: false,
    placeholder: "List any allergies, medications, or health concerns we should know about (e.g., asthma, diabetes, food allergies, etc.)"
  },
  {
    name: "medications",
    label: "Current Medications",
    type: "textarea",
    required: false,
    placeholder: "List any medications you are currently taking"
  },
  {
    name: "dietaryRestrictions",
    label: "Dietary Restrictions",
    type: "select",
    required: false,
    options: [
      { value: "", label: "Select if any" },
      { value: "none", label: "No restrictions" },
      { value: "vegetarian", label: "Vegetarian" },
      { value: "allergies", label: "Food Allergies" },
      { value: "other", label: "Other (specify in medical conditions)" }
    ]
  },
  {
    name: "emergencyContact",
    label: "Emergency Contact Name",
    type: "text",
    required: true,
    placeholder: "Full name of emergency contact"
  },
  {
    name: "emergencyPhone", 
    label: "Emergency Contact Phone",
    type: "tel",
    required: true,
    placeholder: "+234 800 123 4567"
  },
  {
    name: "emergencyRelationship",
    label: "Relationship with Emergency Contact",
    type: "text",
    required: true,
    placeholder: "e.g., Mother, Father, Guardian"
  }
];

export const PARENT_INFO_FIELDS = [
  {
    name: "parentName",
    label: "Parent/Guardian Full Name",
    type: "text",
    required: true,
    placeholder: "Full name of parent or guardian"
  },
  {
    name: "parentEmail",
    label: "Parent/Guardian Email", 
    type: "email",
    required: true,
    placeholder: "parent.email@example.com"
  },
  {
    name: "parentPhone",
    label: "Parent/Guardian Phone",
    type: "tel",
    required: true, 
    placeholder: "+234 800 123 4567"
  },
  {
    name: "parentRelationship",
    label: "Relationship with Participant",
    type: "select",
    required: true,
    options: [
      { value: "", label: "Select Relationship" },
      { value: "mother", label: "Mother" },
      { value: "father", label: "Father" },
      { value: "guardian", label: "Guardian" },
      { value: "sibling", label: "Sibling" },
      { value: "other", label: "Other" }
    ]
  },
  {
    name: "parentConsent",
    label: "I give consent for my child/ward to participate in all camp activities including physical exercises, games, and off-site activities",
    type: "checkbox",
    required: true
  },
  {
    name: "medicalConsent",
    label: "I authorize the camp organizers to seek medical treatment for my child/ward in case of emergency if I cannot be reached",
    type: "checkbox",
    required: true
  },
  {
    name: "photoConsent",
    label: "I consent to photos and videos of my child/ward being taken and used for camp promotional materials",
    type: "checkbox",
    required: false
  }
];