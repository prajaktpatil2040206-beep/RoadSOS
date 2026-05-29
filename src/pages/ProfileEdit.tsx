import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserStore } from '../store/userStore';
import { updateUserProfile } from '../services/userService';
import { Plus, Trash2, Save, ArrowLeft, Camera } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Vehicle, EmergencyContact } from '../types';

export default function ProfileEdit() {
  const { user, updateUser } = useUserStore();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    dateOfBirth: user?.dateOfBirth || '',
    gender: user?.gender || '',
    bloodGroup: user?.bloodGroup || '',
    address: user?.address || '',
    city: user?.city || '',
    country: user?.country || '',
    aadharNumber: user?.aadharNumber || '',
    drivingLicense: user?.drivingLicense || '',
    allergies: user?.medicalInfo?.allergies || '',
    conditions: user?.medicalInfo?.conditions || '',
    medications: user?.medicalInfo?.medications || '',
    organDonor: user?.medicalInfo?.organDonor ?? false,
  });

  const [vehicles, setVehicles] = useState<Vehicle[]>(user?.vehicles || []);
  const [contacts, setContacts] = useState<EmergencyContact[]>(user?.emergencyContacts || []);
  const [photoBase64, setPhotoBase64] = useState<string>(user?.photoBase64 || '');
  const [tab, setTab] = useState<'personal' | 'medical' | 'vehicles' | 'contacts' | 'photo'>('personal');
  const fileInputRef = useRef<HTMLInputElement>(null);

  function setF(key: string, val: string | boolean) {
    setForm(f => ({ ...f, [key]: val }));
  }

  function addVehicle() {
    setVehicles(v => [...v, { id: Date.now().toString(), type: 'Car', make: '', model: '', color: '', registration: '', insurance: '', licenseNumber: '' }]);
  }
  function updateVehicle(id: string, key: keyof Vehicle, val: string) {
    setVehicles(v => v.map(veh => veh.id === id ? { ...veh, [key]: val } : veh));
  }
  function removeVehicle(id: string) { setVehicles(v => v.filter(veh => veh.id !== id)); }

  function addContact() {
    setContacts(c => [...c, { id: Date.now().toString(), name: '', phone: '', relation: '' }]);
  }
  function updateContact(id: string, key: keyof EmergencyContact, val: string) {
    setContacts(c => c.map(con => con.id === id ? { ...con, [key]: val } : con));
  }
  function removeContact(id: string) { setContacts(c => c.filter(con => con.id !== id)); }

  function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be under 5MB'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      // Compress image using canvas
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX = 300;
        const scale = Math.min(MAX / img.width, MAX / img.height, 1);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const compressed = canvas.toDataURL('image/jpeg', 0.75);
        setPhotoBase64(compressed);
        toast.success('Photo ready — click Save to upload');
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  }

  async function handleSave() {
    if (!user) return;
    setSaving(true);
    try {
      const updates = {
        name: form.name,
        phone: form.phone,
        dateOfBirth: form.dateOfBirth,
        gender: form.gender,
        bloodGroup: form.bloodGroup,
        address: form.address,
        city: form.city,
        country: form.country,
        aadharNumber: form.aadharNumber,
        drivingLicense: form.drivingLicense,
        medicalInfo: { allergies: form.allergies, conditions: form.conditions, medications: form.medications, organDonor: form.organDonor },
        vehicles,
        emergencyContacts: contacts,
        ...(photoBase64 ? { photoBase64 } : {}),
      };
      await updateUserProfile(user.uid, updates);
      updateUser(updates);
      toast.success('Profile saved!');
      navigate('/profile');
    } catch (e: any) {
      toast.error(e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  const TABS = [
    { key: 'personal', label: '👤 Personal' },
    { key: 'medical', label: '🩺 Medical' },
    { key: 'vehicles', label: '🚗 Vehicles' },
    { key: 'contacts', label: '📞 Contacts' },
    { key: 'photo', label: '📷 Photo' },
  ] as const;

  return (
    <div className="page" style={{ overflowY: 'auto' }}>
      <div style={{ maxWidth: 680, margin: '0 auto', paddingBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={() => navigate('/profile')}>
            <ArrowLeft size={18} />
          </button>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0F172A' }}>Edit Profile</h1>
          <button className="btn btn-primary btn-sm" style={{ marginLeft: 'auto' }} onClick={handleSave} disabled={saving}>
            {saving ? <><div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Saving…</> : <><Save size={14} /> Save</>}
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: '#fff', borderRadius: 'var(--r-md)', padding: 4, border: '1px solid #E2E8F0', overflowX: 'auto' }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{
                flex: 1, padding: '8px 12px', border: 'none', borderRadius: 'var(--r-sm)',
                background: tab === t.key ? 'var(--primary)' : 'transparent',
                color: tab === t.key ? '#fff' : '#64748B',
                fontFamily: 'inherit', fontWeight: 600, fontSize: '0.78rem', cursor: 'pointer',
                whiteSpace: 'nowrap', transition: 'all 0.15s'
              }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Personal */}
        {tab === 'personal' && (
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0F172A', borderBottom: '1px solid #E2E8F0', paddingBottom: '0.5rem' }}>Personal Information</h3>
            <div className="grid-2">
              <div className="form-group">
                <label className="label">Full Name *</label>
                <input className="input" value={form.name} onChange={e => setF('name', e.target.value)} placeholder="Your full name" />
              </div>
              <div className="form-group">
                <label className="label">Phone Number *</label>
                <input className="input" type="tel" value={form.phone} onChange={e => setF('phone', e.target.value)} placeholder="+91 9876543210" />
              </div>
              <div className="form-group">
                <label className="label">Date of Birth</label>
                <input className="input" type="date" value={form.dateOfBirth} onChange={e => setF('dateOfBirth', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="label">Gender</label>
                <select className="input" value={form.gender} onChange={e => setF('gender', e.target.value)}>
                  <option value="">Select…</option>
                  <option>Male</option><option>Female</option><option>Other</option><option>Prefer not to say</option>
                </select>
              </div>
              <div className="form-group">
                <label className="label">Blood Group</label>
                <select className="input" value={form.bloodGroup} onChange={e => setF('bloodGroup', e.target.value)}>
                  <option value="">Select…</option>
                  {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(g => <option key={g}>{g}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="label">Aadhaar Number</label>
                <input className="input" value={form.aadharNumber} onChange={e => setF('aadharNumber', e.target.value)} placeholder="1234 5678 9012" maxLength={14} />
              </div>
              <div className="form-group">
                <label className="label">Driving License</label>
                <input className="input" value={form.drivingLicense} onChange={e => setF('drivingLicense', e.target.value)} placeholder="DL-1234567890" />
              </div>
            </div>
            <div className="form-group">
              <label className="label">Address</label>
              <input className="input" value={form.address} onChange={e => setF('address', e.target.value)} placeholder="Street address" />
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="label">City</label>
                <input className="input" value={form.city} onChange={e => setF('city', e.target.value)} placeholder="City" />
              </div>
              <div className="form-group">
                <label className="label">Country</label>
                <input className="input" value={form.country} onChange={e => setF('country', e.target.value)} placeholder="Country" />
              </div>
            </div>
          </div>
        )}

        {/* Medical */}
        {tab === 'medical' && (
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0F172A', borderBottom: '1px solid #E2E8F0', paddingBottom: '0.5rem' }}>Medical Information</h3>
            <p style={{ fontSize: '0.82rem', color: '#64748B' }}>This info is shown on your emergency ID card and helps responders.</p>
            <div className="form-group">
              <label className="label">Allergies</label>
              <input className="input" value={form.allergies} onChange={e => setF('allergies', e.target.value)} placeholder="e.g., Penicillin, Peanuts" />
            </div>
            <div className="form-group">
              <label className="label">Medical Conditions</label>
              <textarea className="input" value={form.conditions} onChange={e => setF('conditions', e.target.value)} placeholder="e.g., Diabetes, Hypertension" rows={3} />
            </div>
            <div className="form-group">
              <label className="label">Current Medications</label>
              <textarea className="input" value={form.medications} onChange={e => setF('medications', e.target.value)} placeholder="e.g., Metformin 500mg" rows={3} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#F8FAFC', padding: '1rem', borderRadius: 8, border: '1px solid #E2E8F0' }}>
              <input type="checkbox" id="donor" checked={form.organDonor}
                onChange={e => setF('organDonor', e.target.checked)}
                style={{ width: 18, height: 18, accentColor: 'var(--primary)', cursor: 'pointer' }} />
              <label htmlFor="donor" style={{ cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600, color: '#0F172A' }}>I am an Organ Donor 💚</label>
            </div>
          </div>
        )}

        {/* Vehicles */}
        {tab === 'vehicles' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {vehicles.map(v => (
              <div key={v.id} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, borderBottom: '1px solid #E2E8F0', paddingBottom: '0.5rem' }}>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0F172A' }}>Vehicle Details</h4>
                  <button className="btn btn-ghost btn-icon btn-sm" onClick={() => removeVehicle(v.id)} style={{ color: '#EF4444' }}>
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="grid-2" style={{ gap: 12 }}>
                  {[
                    { key: 'type', label: 'Type', opts: ['Car','Bike','Truck','Bus','Auto'] },
                  ].map(({ key, opts }) => (
                    <div key={key} className="form-group">
                      <label className="label">{key.charAt(0).toUpperCase() + key.slice(1)}</label>
                      <select className="input" value={(v as any)[key]} onChange={e => updateVehicle(v.id, key as keyof Vehicle, e.target.value)}>
                        {opts.map(o => <option key={o}>{o}</option>)}
                      </select>
                    </div>
                  ))}
                  {(['make','model','color','registration','licenseNumber','insurance'] as const).map(k => (
                    <div key={k} className="form-group">
                      <label className="label">{k === 'licenseNumber' ? 'DL Number' : k === 'registration' ? 'Reg. Number' : k.charAt(0).toUpperCase() + k.slice(1)}</label>
                      <input className="input" value={v[k] || ''} onChange={e => updateVehicle(v.id, k, e.target.value)} placeholder={k} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <button className="btn btn-secondary" onClick={addVehicle} style={{ justifyContent: 'center', marginTop: 8 }}>
              <Plus size={16} /> Add Vehicle
            </button>
          </div>
        )}

        {/* Photo */}
        {tab === 'photo' && (
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 20, alignItems: 'center' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0F172A', alignSelf: 'stretch', borderBottom: '1px solid #E2E8F0', paddingBottom: '0.5rem', marginBottom: 0 }}>Profile Photo</h3>
            <p style={{ fontSize: '0.82rem', textAlign: 'center', color: '#64748B' }}>Photo is stored securely (base64) in the database. Recommended: clear face photo under 5MB.</p>
            {photoBase64 ? (
              <img src={photoBase64} alt="Preview" style={{ width: 130, height: 130, borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--primary)', boxShadow: '0 4px 14px rgba(79, 70, 229, 0.2)' }} />
            ) : (
              <div style={{ width: 130, height: 130, borderRadius: '50%', background: '#F8FAFC', border: '2px dashed #CBD5E1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Camera size={32} color="#94A3B8" />
              </div>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoUpload} />
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-secondary btn-sm" onClick={() => fileInputRef.current?.click()}>
                <Camera size={14} /> {photoBase64 ? 'Change Photo' : 'Upload Photo'}
              </button>
              {photoBase64 && (
                <button className="btn btn-ghost btn-sm" style={{ color: '#EF4444' }} onClick={() => { setPhotoBase64(''); toast.success('Photo removed'); }}>
                  Remove
                </button>
              )}
            </div>
            <p style={{ fontSize: '0.75rem', color: '#94A3B8', textAlign: 'center' }}>Photo is compressed to 300×300px before saving to minimize storage usage.</p>
          </div>
        )}

        {/* Contacts */}
        {tab === 'contacts' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {contacts.map(c => (
              <div key={c.id} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, borderBottom: '1px solid #E2E8F0', paddingBottom: '0.5rem' }}>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0F172A' }}>Emergency Contact</h4>
                  <button className="btn btn-ghost btn-icon btn-sm" onClick={() => removeContact(c.id)} style={{ color: '#EF4444' }}>
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="grid-2" style={{ gap: 12 }}>
                  <div className="form-group">
                    <label className="label">Full Name</label>
                    <input className="input" value={c.name} onChange={e => updateContact(c.id, 'name', e.target.value)} placeholder="Contact name" />
                  </div>
                  <div className="form-group">
                    <label className="label">Phone</label>
                    <input className="input" type="tel" value={c.phone} onChange={e => updateContact(c.id, 'phone', e.target.value)} placeholder="+91 9876543210" />
                  </div>
                  <div className="form-group" style={{ gridColumn: '1/-1' }}>
                    <label className="label">Relationship</label>
                    <select className="input" value={c.relation} onChange={e => updateContact(c.id, 'relation', e.target.value)}>
                      <option value="">Select…</option>
                      {['Spouse','Parent','Sibling','Child','Friend','Doctor','Other'].map(r => <option key={r}>{r}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            ))}
            <button className="btn btn-secondary" onClick={addContact} style={{ justifyContent: 'center', marginTop: 8 }}>
              <Plus size={16} /> Add Contact
            </button>
          </div>
        )}

        <button className="btn btn-primary btn-lg" style={{ width: '100%', justifyContent: 'center', marginTop: 24 }} onClick={handleSave} disabled={saving}>
          {saving ? <><div className="spinner" style={{ borderWidth: 2 }} /> Saving…</> : <><Save size={18} /> Save Profile</>}
        </button>
      </div>
    </div>
  );
}
