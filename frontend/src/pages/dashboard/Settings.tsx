import { useCallback, useEffect, useRef, useState } from 'react';
import {
    User as UserIcon, Mail, Phone, Lock, Eye, EyeOff, Save, Loader, Shield, LogOut,
    Camera, MapPin, HeartPulse, Users, CalendarDays,
} from 'lucide-react';
import { useAuthContext } from '../../context/AuthContext';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import type { TeenProfile, User } from '../../types';
import { PROVINCES } from '../../constants/formFields';

// ─── Section Wrapper ──────────────────────────────────────────────────────────
const Section = ({ title, description, children }: { title: string; description: string; children: React.ReactNode }) => (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
            <h3 className="text-base font-bold text-gray-900 dark:text-white">{title}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{description}</p>
        </div>
        <div className="px-6 py-5">{children}</div>
    </div>
);

// ─── Field ────────────────────────────────────────────────────────────────────
const Field = ({
    label, icon: Icon, type = 'text', value, name, onChange, placeholder, disabled = false, required = false, hint
}: {
    label: string; icon: React.ElementType; type?: string; value: string;
    name: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    placeholder?: string; disabled?: boolean; required?: boolean; hint?: string;
}) => {
    const [show, setShow] = useState(false);
    const isPassword = type === 'password';
    return (
        <div>
            <label htmlFor={name} className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                {label} {required && <span className="text-red-500">*</span>}
            </label>
            <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Icon size={16} className="text-gray-400" />
                </div>
                <input
                    type={isPassword && show ? 'text' : type}
                    id={name}
                    name={name}
                    value={value}
                    onChange={onChange}
                    placeholder={placeholder}
                    disabled={disabled}
                    required={required}
                    className="w-full pl-9 pr-10 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                />
                {isPassword && (
                    <button type="button" onClick={() => setShow(!show)} className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                        {show ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                )}
            </div>
            {hint && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">{hint}</p>}
        </div>
    );
};

const TextArea = ({
    label, value, name, onChange, placeholder, hint, rows = 3,
}: {
    label: string; value: string; name: string;
    onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
    placeholder?: string; hint?: string; rows?: number;
}) => (
    <div>
        <label htmlFor={name} className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">{label}</label>
        <textarea
            id={name}
            name={name}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            rows={rows}
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
        />
        {hint && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">{hint}</p>}
    </div>
);

// ─── Toggle ───────────────────────────────────────────────────────────────────
const Toggle = ({ label, description, checked, onChange }: {
    label: string; description: string; checked: boolean; onChange: () => void
}) => (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-gray-50 dark:border-gray-700/50 last:border-0">
        <div>
            <p className="text-sm font-semibold text-gray-800 dark:text-white">{label}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{description}</p>
        </div>
        <button
            type="button"
            onClick={onChange}
            aria-pressed={checked}
            aria-label={label}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${checked ? 'bg-primary-600' : 'bg-gray-200 dark:bg-gray-600'}`}
        >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
    </div>
);

/** The teen fields this page edits, in the order the form shows them. */
type TeenForm = {
    date_of_birth: string;
    province: string;
    bio: string;
    parish: string;
    zone: string;
    area: string;
    department: string;
    guardian_name: string;
    guardian_phone: string;
    guardian_email: string;
    guardian_relationship: string;
    emergency_contact_name: string;
    emergency_contact_phone: string;
    emergency_contact_relationship: string;
    medical_conditions: string;
    allergies: string;
    medications: string;
    dietary_restrictions: string;
    blood_group: string;
};

const EMPTY_TEEN: TeenForm = {
    date_of_birth: '', province: '', bio: '', parish: '', zone: '', area: '', department: '',
    guardian_name: '', guardian_phone: '', guardian_email: '', guardian_relationship: '',
    emergency_contact_name: '', emergency_contact_phone: '', emergency_contact_relationship: '',
    medical_conditions: '', allergies: '', medications: '', dietary_restrictions: '', blood_group: '',
};

function teenFormFrom(profile: TeenProfile): TeenForm {
    const read = (key: keyof TeenForm) => String(profile[key] ?? '');
    return Object.fromEntries(
        (Object.keys(EMPTY_TEEN) as (keyof TeenForm)[]).map((key) => [key, read(key)]),
    ) as TeenForm;
}

/** Prefer the field message DRF sent over a generic failure. */
function errorMessage(err: unknown, fallback: string): string {
    const data = (err as { response?: { data?: unknown } })?.response?.data;
    if (data && typeof data === 'object') {
        const body = data as Record<string, unknown>;
        if (typeof body.detail === 'string') return body.detail;
        const first = Object.values(body)[0];
        if (Array.isArray(first) && typeof first[0] === 'string') return first[0];
        if (typeof first === 'string') return first;
    }
    return fallback;
}

// ─── Settings Page ────────────────────────────────────────────────────────────
const Settings = () => {
    const { user, logout, updateProfile, refreshUser } = useAuthContext();

    const [profileData, setProfileData] = useState({
        first_name: user?.first_name || '',
        last_name: user?.last_name || '',
        email: user?.email || '',
        phone: user?.phone || '',
        gender: user?.gender || '',
    });
    const [profileLoading, setProfileLoading] = useState(false);

    const [teen, setTeen] = useState<TeenForm | null>(null);
    const [teenLoading, setTeenLoading] = useState(true);
    const [teenSaving, setTeenSaving] = useState(false);
    const [teenError, setTeenError] = useState<string | null>(null);

    const [photoPreview, setPhotoPreview] = useState<string | null>(null);
    const [photoLoading, setPhotoLoading] = useState(false);
    const [photoNeedsRefresh, setPhotoNeedsRefresh] = useState(false);
    const photoInput = useRef<HTMLInputElement>(null);

    const [passwordData, setPasswordData] = useState({
        current_password: '',
        new_password: '',
        confirm_password: '',
    });
    const [passwordLoading, setPasswordLoading] = useState(false);

    const [notifications, setNotifications] = useState({
        devotional_reminders: true,
        event_alerts: true,
        weekly_digest: false,
        sms_notifications: false,
    });

    // The teen profile is a second record. Load it once so the form opens with
    // what the app already knows, rather than a blank page that would overwrite
    // a guardian's phone number with an empty string on save.
    const loadTeen = useCallback(async () => {
        setTeenLoading(true);
        setTeenError(null);
        try {
            const { data } = await api.get<TeenProfile>('/profiles/me/');
            setTeen(teenFormFrom(data));
        } catch (err) {
            // Do not hand back an editable empty form. Saving it would send ''
            // for every guardian, emergency and medical field the teen already
            // had, and the PATCH would overwrite them.
            setTeen(null);
            setTeenError(errorMessage(err, 'We could not load your church and contact details.'));
        } finally {
            setTeenLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadTeen();
    }, [loadTeen]);

    // A chosen file is shown immediately; the old object URL is released when
    // the next photo replaces it or the page closes.
    useEffect(() => {
        return () => {
            if (photoPreview) URL.revokeObjectURL(photoPreview);
        };
    }, [photoPreview]);

    // Profile update
    const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setProfileData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const saveProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        setProfileLoading(true);
        try {
            await updateProfile({
                first_name: profileData.first_name,
                last_name: profileData.last_name,
                email: profileData.email,
                phone: profileData.phone,
                gender: profileData.gender,
            } as Partial<User>);
            toast.success('Profile updated successfully!');
        } catch (err) {
            toast.error(errorMessage(err, 'Failed to update profile'));
        } finally {
            setProfileLoading(false);
        }
    };

    const choosePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        // Let the same file be chosen again after a failure.
        e.target.value = '';
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) {
            toast.error('That photo is larger than 5 MB. Choose a smaller one.');
            return;
        }

        const preview = URL.createObjectURL(file);
        setPhotoPreview((old) => {
            if (old) URL.revokeObjectURL(old);
            return preview;
        });
        setPhotoLoading(true);
        try {
            const body = new FormData();
            body.append('avatar', file);
            const { data } = await api.patch<TeenProfile>('/profiles/me/', body, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            setTeen((current) => (current ? { ...current, ...teenFormFrom(data) } : current));
            setPhotoNeedsRefresh(false);
            toast.success('Photo updated.');
        } catch (err) {
            URL.revokeObjectURL(preview);
            setPhotoPreview(null);
            toast.error(errorMessage(err, 'That photo did not upload. Try again.'));
            return;
        } finally {
            setPhotoLoading(false);
        }

        // The API mirrors the profile photo onto the account. Re-read it so the
        // header, the dropdown and this page all show the same picture. The
        // upload already succeeded; a failure here is a stale header, not a
        // lost photo, so it gets its own warning and retry below.
        try {
            await refreshUser();
            setPhotoNeedsRefresh(false);
        } catch {
            setPhotoNeedsRefresh(true);
        }
    };

    const retryPhotoRefresh = async () => {
        try {
            await refreshUser();
            setPhotoNeedsRefresh(false);
            toast.success('Header updated.');
        } catch {
            toast.error('Still could not refresh the header. Reload the page.');
        }
    };

    const saveTeen = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!teen) return;
        setTeenSaving(true);
        try {
            // A cleared date is `null` to the API, not an empty string: DRF's
            // DateField rejects `''` even though the model column is nullable.
            const { data } = await api.patch<TeenProfile>('/profiles/me/', {
                ...teen,
                date_of_birth: teen.date_of_birth || null,
            });
            setTeen(teenFormFrom(data));
            setTeenError(null);
            // A birthday edit changes the derived age group, and a province edit
            // changes the account field registrations prefill from. Both live on
            // the cached account, so re-read it. The save itself already worked.
            try {
                await refreshUser();
            } catch {
                // Ignored: the next page load re-reads the account.
            }
            toast.success('Your details were saved.');
        } catch (err) {
            toast.error(errorMessage(err, 'Those details did not save. Try again.'));
        } finally {
            setTeenSaving(false);
        }
    };

    // Password change
    const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setPasswordData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const savePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (passwordData.new_password !== passwordData.confirm_password) {
            toast.error("New passwords don't match");
            return;
        }
        if (passwordData.new_password.length < 8) {
            toast.error('Password must be at least 8 characters');
            return;
        }
        setPasswordLoading(true);
        try {
            await api.post('/auth/change-password/', {
                current_password: passwordData.current_password,
                new_password: passwordData.new_password,
            });
            toast.success('Password changed successfully!');
            setPasswordData({ current_password: '', new_password: '', confirm_password: '' });
        } catch (err) {
            toast.error(errorMessage(err, 'Failed to change password'));
        } finally {
            setPasswordLoading(false);
        }
    };

    const displayName = user?.first_name
        ? `${user.first_name} ${user.last_name || ''}`.trim()
        : user?.username || 'User';

    const initials = displayName.split(' ').map((s: string) => s[0]).join('').slice(0, 2).toUpperCase();
    const avatarUrl = photoPreview || user?.profile_picture || null;
    const onTeenInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setTeen(prev => (prev ? { ...prev, [name]: value } : prev));
    };
    const onTeenText = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setTeen(prev => (prev ? { ...prev, [name]: value } : prev));
    };

    return (
        <div className="max-w-2xl mx-auto space-y-6 pb-12">
            {/* Page Header */}
            <div className="mb-2">
                <h1 className="text-2xl font-black text-gray-900 dark:text-white">Settings</h1>
                <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Manage your account, profile and preferences</p>
            </div>

            {/* Photo + Identity */}
            <Section title="Profile photo" description="This is how you appear across Faith Tribe">
                <div className="flex flex-wrap items-center gap-5">
                    <div className="relative">
                        {avatarUrl ? (
                            <img
                                src={avatarUrl}
                                alt={`${displayName}'s profile photo`}
                                className="w-20 h-20 rounded-full object-cover ring-4 ring-primary-100 dark:ring-primary-900/50"
                            />
                        ) : (
                            <div className="w-20 h-20 rounded-full bg-primary-600 flex items-center justify-center text-white font-bold text-2xl ring-4 ring-primary-100 dark:ring-primary-900/50">
                                {initials}
                            </div>
                        )}
                        {photoLoading && (
                            <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
                                <Loader size={22} className="animate-spin text-white" />
                            </div>
                        )}
                    </div>
                    <div className="min-w-0">
                        <p className="font-bold text-gray-900 dark:text-white">{displayName}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">@{user?.username}</p>
                        {user?.role && (
                            <span className="inline-block mt-1 px-2 py-0.5 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 text-[10px] font-bold uppercase tracking-wider rounded-full">
                                {user.role}
                            </span>
                        )}
                    </div>
                    <div className="w-full sm:w-auto sm:ml-auto">
                        <input
                            ref={photoInput}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={choosePhoto}
                        />
                        <button
                            type="button"
                            onClick={() => photoInput.current?.click()}
                            disabled={photoLoading}
                            className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white text-sm font-bold rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
                        >
                            <Camera size={16} />
                            {avatarUrl ? 'Change photo' : 'Add a photo'}
                        </button>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">JPG, PNG or WebP, up to 5 MB.</p>
                        {photoNeedsRefresh && (
                            <p className="text-xs text-amber-700 dark:text-amber-300 mt-2">
                                The photo saved, but the header could not refresh.{' '}
                                <button
                                    type="button"
                                    onClick={retryPhotoRefresh}
                                    className="font-bold underline"
                                >
                                    Retry
                                </button>
                            </p>
                        )}
                    </div>
                </div>
            </Section>

            {/* Account */}
            <Section title="Your account" description="Your name, email and phone number">
                <form onSubmit={saveProfile} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field label="First Name" icon={UserIcon} name="first_name" value={profileData.first_name} onChange={handleProfileChange} placeholder="Ada" />
                        <Field label="Last Name" icon={UserIcon} name="last_name" value={profileData.last_name} onChange={handleProfileChange} placeholder="Okafor" />
                    </div>
                    <Field label="Email Address" icon={Mail} type="email" name="email" value={profileData.email} onChange={handleProfileChange} placeholder="you@example.com" required />
                    <Field label="Phone Number" icon={Phone} type="tel" name="phone" value={profileData.phone} onChange={handleProfileChange} placeholder="+234 800 000 0000" />
                    <div>
                        <label htmlFor="gender" className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Gender</label>
                        <select
                            id="gender"
                            name="gender"
                            value={profileData.gender}
                            onChange={(e) => setProfileData(prev => ({ ...prev, gender: e.target.value }))}
                            className="block w-full px-3 py-3 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 sm:text-sm transition-all"
                        >
                            <option value="">Prefer not to say</option>
                            <option value="male">Male</option>
                            <option value="female">Female</option>
                        </select>
                    </div>

                    <div className="pt-2 flex justify-end">
                        <button
                            type="submit"
                            disabled={profileLoading}
                            className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-bold rounded-xl transition-all disabled:opacity-50"
                        >
                            {profileLoading ? <Loader size={16} className="animate-spin" /> : <Save size={16} />}
                            Save Account
                        </button>
                    </div>
                </form>
            </Section>

            {/* Church + contact details */}
            <Section title="Your church and contact details" description="Keep these up to date. The app uses them to prefill event registration.">
                {teenLoading ? (
                    <div className="py-8 flex items-center justify-center text-gray-400">
                        <Loader size={22} className="animate-spin" />
                    </div>
                ) : teenError ? (
                    <div className="space-y-3">
                        <p className="text-sm text-amber-700 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-300 rounded-xl px-3 py-2">
                            {teenError}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            The form stays locked until your saved details load, so saving it
                            cannot overwrite them with blanks.
                        </p>
                        <button
                            type="button"
                            onClick={() => void loadTeen()}
                            className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white text-sm font-bold rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                        >
                            Try again
                        </button>
                    </div>
                ) : teen ? (
                    <form onSubmit={saveTeen} className="space-y-5">
                        <div>
                            <h4 className="flex items-center gap-2 text-sm font-bold text-gray-800 dark:text-white mb-3">
                                <CalendarDays size={16} className="text-primary-600" /> About you
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <Field
                                    label="Date of birth"
                                    icon={CalendarDays}
                                    type="date"
                                    name="date_of_birth"
                                    value={teen.date_of_birth}
                                    onChange={onTeenInput}
                                    hint="Your age group updates when you save."
                                />
                                <div>
                                    <label htmlFor="province" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Province</label>
                                    <select
                                        id="province"
                                        name="province"
                                        value={teen.province}
                                        onChange={(e) => setTeen(prev => (prev ? { ...prev, province: e.target.value } : prev))}
                                        className="block w-full px-3 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 sm:text-sm transition-all"
                                    >
                                        <option value="">Select your province</option>
                                        {PROVINCES.map((province) => (
                                            <option key={province.value} value={province.value}>{province.label}</option>
                                        ))}
                                    </select>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">Where your parish belongs.</p>
                                </div>
                            </div>
                        </div>

                        <div>
                            <h4 className="flex items-center gap-2 text-sm font-bold text-gray-800 dark:text-white mb-3">
                                <MapPin size={16} className="text-primary-600" /> Your church
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <Field label="Parish" icon={MapPin} name="parish" value={teen.parish} onChange={onTeenInput} placeholder="RCCG Victory House" />
                                <Field label="Zone" icon={MapPin} name="zone" value={teen.zone} onChange={onTeenInput} />
                                <Field label="Area" icon={MapPin} name="area" value={teen.area} onChange={onTeenInput} />
                                <Field label="Department" icon={Users} name="department" value={teen.department} onChange={onTeenInput} placeholder="Choir, ushering, media" />
                            </div>
                        </div>

                        <div>
                            <h4 className="flex items-center gap-2 text-sm font-bold text-gray-800 dark:text-white mb-3">
                                <Users size={16} className="text-primary-600" /> Parent or guardian
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <Field label="Their name" icon={UserIcon} name="guardian_name" value={teen.guardian_name} onChange={onTeenInput} />
                                <Field label="Their phone" icon={Phone} name="guardian_phone" value={teen.guardian_phone} onChange={onTeenInput} />
                                <Field label="Their email" icon={Mail} name="guardian_email" value={teen.guardian_email} onChange={onTeenInput} />
                                <Field label="Who are they to you?" icon={Users} name="guardian_relationship" value={teen.guardian_relationship} onChange={onTeenInput} placeholder="Mum, Dad, Aunt" />
                            </div>
                        </div>

                        <div>
                            <h4 className="flex items-center gap-2 text-sm font-bold text-gray-800 dark:text-white mb-3">
                                <HeartPulse size={16} className="text-primary-600" /> If something happens
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <Field label="Emergency contact" icon={UserIcon} name="emergency_contact_name" value={teen.emergency_contact_name} onChange={onTeenInput} />
                                <Field label="Emergency phone" icon={Phone} name="emergency_contact_phone" value={teen.emergency_contact_phone} onChange={onTeenInput} />
                                <Field label="Who are they to you?" icon={Users} name="emergency_contact_relationship" value={teen.emergency_contact_relationship} onChange={onTeenInput} />
                                <Field label="Blood group" icon={HeartPulse} name="blood_group" value={teen.blood_group} onChange={onTeenInput} placeholder="e.g. O+" />
                            </div>
                            <div className="grid grid-cols-1 gap-4 mt-4">
                                <TextArea label="Allergies" name="allergies" value={teen.allergies} onChange={onTeenText} />
                                <TextArea label="Medication you take" name="medications" value={teen.medications} onChange={onTeenText} hint="Only what the team would need at camp." />
                                <TextArea label="Food you do not eat" name="dietary_restrictions" value={teen.dietary_restrictions} onChange={onTeenText} />
                                <TextArea label="Anything else the team should know" name="medical_conditions" value={teen.medical_conditions} onChange={onTeenText} />
                            </div>
                        </div>

                        <TextArea label="A line about you" name="bio" value={teen.bio} onChange={onTeenText} hint="Shown on your profile. Keep it short." />

                        <div className="pt-1 flex justify-end">
                            <button
                                type="submit"
                                disabled={teenSaving}
                                className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-bold rounded-xl transition-all disabled:opacity-50"
                            >
                                {teenSaving ? <Loader size={16} className="animate-spin" /> : <Save size={16} />}
                                Save Details
                            </button>
                        </div>
                    </form>
                ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400">These details are not available for this account.</p>
                )}
            </Section>

            {/* Password Change */}
            <Section title="Change Password" description="Keep your account secure with a strong password">
                <form onSubmit={savePassword} className="space-y-4">
                    <Field label="Current Password" icon={Lock} type="password" name="current_password" value={passwordData.current_password} onChange={handlePasswordChange} placeholder="Enter current password" required />
                    <Field label="New Password" icon={Lock} type="password" name="new_password" value={passwordData.new_password} onChange={handlePasswordChange} placeholder="Min. 8 characters" required />
                    <Field
                        label="Confirm New Password"
                        icon={Lock}
                        type="password"
                        name="confirm_password"
                        value={passwordData.confirm_password}
                        onChange={handlePasswordChange}
                        placeholder="Repeat new password"
                        required
                    />
                    {passwordData.confirm_password && passwordData.new_password !== passwordData.confirm_password && (
                        <p className="text-xs text-red-500">Passwords don't match</p>
                    )}
                    <div className="pt-2 flex justify-end">
                        <button
                            type="submit"
                            disabled={passwordLoading}
                            className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-bold rounded-xl transition-all disabled:opacity-50"
                        >
                            {passwordLoading ? <Loader size={16} className="animate-spin" /> : <Shield size={16} />}
                            Update Password
                        </button>
                    </div>
                </form>
            </Section>

            {/* Notifications */}
            <Section title="Notifications" description="Choose what you want to be notified about">
                <Toggle
                    label="Daily Devotional Reminders"
                    description="Get reminded when a new devotional is published"
                    checked={notifications.devotional_reminders}
                    onChange={() => setNotifications(p => ({ ...p, devotional_reminders: !p.devotional_reminders }))}
                />
                <Toggle
                    label="Event Alerts"
                    description="Be notified about upcoming events and registrations"
                    checked={notifications.event_alerts}
                    onChange={() => setNotifications(p => ({ ...p, event_alerts: !p.event_alerts }))}
                />
                <Toggle
                    label="Weekly Digest"
                    description="A weekly summary of content, events and highlights"
                    checked={notifications.weekly_digest}
                    onChange={() => setNotifications(p => ({ ...p, weekly_digest: !p.weekly_digest }))}
                />
                <Toggle
                    label="SMS Notifications"
                    description="Receive critical alerts via text message"
                    checked={notifications.sms_notifications}
                    onChange={() => setNotifications(p => ({ ...p, sms_notifications: !p.sms_notifications }))}
                />
            </Section>

            {/* Danger Zone */}
            <Section title="Account" description="Manage your session">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm font-semibold text-gray-800 dark:text-white">Sign Out</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Sign out of your account on this device</p>
                    </div>
                    <button
                        onClick={logout}
                        className="flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-xl text-sm font-bold transition-colors"
                    >
                        <LogOut size={16} />
                        Sign Out
                    </button>
                </div>
            </Section>
        </div>
    );
};

export default Settings;