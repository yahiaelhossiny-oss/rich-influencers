/* Join the RICH Influencer Network: registration, login and self-service profile (EN / AR) */
(() => {
'use strict';
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const root = $('#j');

const T = {
	en: {
		login: 'Log in', logout: 'Log out', myprofile: 'My profile', register: 'Register',
		hero1: 'Join the <em>RICH</em> Influencer Network',
		hero2: 'RICH Agency connects UAE creators with brands across Dubai, Abu Dhabi and Sharjah. Register once, keep your stats and rates current, and get considered for campaigns that fit your content.',
		perk1: 'Real campaigns', perk1d: 'Food, beauty, lifestyle, luxury, family, tech and more.',
		perk2: 'You control your data', perk2d: 'Log in any time to update followers, rates and contacts.',
		perk3: 'All sizes welcome', perk3d: 'From nano creators to celebrities.',
		s1: 'About you', s1d: 'How brands and our team will know you.',
		s2: 'Your content', s2d: 'Pick your main category, then any others you cover.',
		s3: 'Social media', s3d: 'Add at least one account. Stats are optional but help us match you.',
		s4: 'Collaboration rates', s4d: 'In AED. Leave blank if you prefer to share rates on request.',
		s5: 'Your login', s5d: 'Use it later to update your profile.',
		photo: 'Profile picture', photoBtn: 'Upload photo', photoHint: 'JPG, PNG or WEBP, up to 5 MB. A clear headshot works best.',
		full_name: 'Full name', email: 'Email address', whatsapp: 'Phone / WhatsApp', city: 'City', otherCity: 'Other city',
		gender: 'Gender', female: 'Female', male: 'Male', other: 'Other / prefer not to say', nationality: 'Nationality', optional: 'optional',
		languages: 'Languages you create content in', otherLang: 'Other language', agency: 'Management agency', agencyHint: 'If someone manages your bookings',
		primary: 'Main content category', choose: 'Choose…', extra: 'Other categories', bio: 'Short bio', bioPh: 'Who you are and what you post, in 2–3 sentences.',
		ctypes: 'Type of content you create', ctypesPh: 'e.g. Restaurant reviews, GRWM, unboxings, vlogs', availability: 'Availability for collaborations',
		av_available: 'Available', av_limited: 'Limited', av_unavailable: 'Not available right now', av_unknown: 'Prefer not to say',
		ig: 'Instagram', tt: 'TikTok', username: 'Username or profile link', followers: 'Followers', er: 'Engagement rate %', views_ig: 'Avg Reel views', views_tt: 'Avg video views',
		likes: 'Avg likes', comments: 'Avg comments', moreStats: 'More stats',
		r_reel: 'Instagram Reel', r_story: 'Instagram Story', r_post: 'Instagram Post', r_carousel: 'Instagram Carousel', r_tt: 'TikTok Video', r_live: 'TikTok Live', r_pkg: 'Collaboration package',
		password: 'Create a password', passHint: 'At least 8 characters.',
		consent: 'I agree that RICH Agency may store the information I have submitted and use it to consider me for influencer marketing opportunities, including sharing my profile, public social statistics and rates with RICH clients. I can update my details or ask RICH to delete my profile at any time.',
		submit: 'Submit registration', saving: 'Saving…', required: 'Fields marked * are required.',
		doneT: 'Thank you, you’re registered', doneD: 'Our team will review your profile shortly. You can log in any time to update your details.', goProfile: 'View my profile',
		loginT: 'Log in to your profile', loginD: 'Use the email and password you registered with.', password2: 'Password', noAcc: 'Not registered yet?', regLink: 'Join the network',
		st_pending: 'Your profile is being reviewed by the RICH team.', st_approved: 'Your profile is live in the RICH Influencer Network.',
		st_info_requested: 'The RICH team needs a few more details:', st_rejected: 'Your registration was not approved this time. You can update your profile and resubmit.',
		save: 'Save changes', resubmit: 'Save and resubmit', saved: 'Saved.', savedReview: 'Saved. Changes to followers, rates, handles or categories go live after the RICH team reviews them.',
		pendingNote: 'Waiting for review:', changePw: 'Change password', current: 'Current password', newpw: 'New password',
		footer: 'RICH Agency · Dubai, UAE. Your information is used only to match you with influencer marketing opportunities.',
		errCheck: 'Please check the highlighted fields.', lang: 'عربي', atLeastOne: 'Add at least one Instagram or TikTok username.'
	},
	ar: {
		login: 'تسجيل الدخول', logout: 'تسجيل الخروج', myprofile: 'ملفي', register: 'التسجيل',
		hero1: 'انضم إلى شبكة <em>RICH</em> للمؤثرين',
		hero2: 'تربط وكالة RICH صنّاع المحتوى في الإمارات بالعلامات التجارية في دبي وأبوظبي والشارقة. سجّل مرة واحدة، وحدّث أرقامك وأسعارك متى شئت، ليتم ترشيحك للحملات المناسبة لمحتواك.',
		perk1: 'حملات حقيقية', perk1d: 'مطاعم، جمال، لايف ستايل، فخامة، عائلة، تقنية وأكثر.',
		perk2: 'بياناتك تحت سيطرتك', perk2d: 'سجّل الدخول في أي وقت لتحديث المتابعين والأسعار وبيانات التواصل.',
		perk3: 'نرحّب بالجميع', perk3d: 'من صنّاع المحتوى الصغار إلى المشاهير.',
		s1: 'معلوماتك', s1d: 'كيف سيتعرّف عليك فريقنا والعلامات التجارية.',
		s2: 'محتواك', s2d: 'اختر الفئة الرئيسية، ثم أي فئات أخرى تقدّمها.',
		s3: 'حسابات التواصل الاجتماعي', s3d: 'أضف حساباً واحداً على الأقل. الإحصائيات اختيارية لكنها تساعدنا في ترشيحك.',
		s4: 'أسعار التعاون', s4d: 'بالدرهم الإماراتي. اتركها فارغة إن كنت تفضّل مشاركتها عند الطلب.',
		s5: 'بيانات الدخول', s5d: 'لتحديث ملفك لاحقاً.',
		photo: 'الصورة الشخصية', photoBtn: 'رفع صورة', photoHint: 'JPG أو PNG أو WEBP، حتى 5 ميغابايت. يُفضّل صورة واضحة للوجه.',
		full_name: 'الاسم الكامل', email: 'البريد الإلكتروني', whatsapp: 'الهاتف / واتساب', city: 'المدينة', otherCity: 'مدينة أخرى',
		gender: 'الجنس', female: 'أنثى', male: 'ذكر', other: 'آخر / أفضّل عدم الذكر', nationality: 'الجنسية', optional: 'اختياري',
		languages: 'لغات المحتوى', otherLang: 'لغة أخرى', agency: 'وكالة الإدارة', agencyHint: 'إن كانت هناك جهة تدير حجوزاتك',
		primary: 'الفئة الرئيسية للمحتوى', choose: 'اختر…', extra: 'فئات أخرى', bio: 'نبذة مختصرة', bioPh: 'من أنت وماذا تنشر، في جملتين أو ثلاث.',
		ctypes: 'نوع المحتوى', ctypesPh: 'مثال: مراجعات مطاعم، روتين، فتح صناديق، فلوقات', availability: 'التوفّر للتعاون',
		av_available: 'متاح', av_limited: 'متاح بشكل محدود', av_unavailable: 'غير متاح حالياً', av_unknown: 'أفضّل عدم الذكر',
		ig: 'إنستغرام', tt: 'تيك توك', username: 'اسم المستخدم أو رابط الحساب', followers: 'المتابعون', er: 'نسبة التفاعل %', views_ig: 'متوسط مشاهدات الريلز', views_tt: 'متوسط مشاهدات الفيديو',
		likes: 'متوسط الإعجابات', comments: 'متوسط التعليقات', moreStats: 'إحصائيات إضافية',
		r_reel: 'ريل إنستغرام', r_story: 'ستوري إنستغرام', r_post: 'منشور إنستغرام', r_carousel: 'منشور متعدد الصور', r_tt: 'فيديو تيك توك', r_live: 'بث مباشر تيك توك', r_pkg: 'باقة تعاون',
		password: 'أنشئ كلمة مرور', passHint: '8 أحرف على الأقل.',
		consent: 'أوافق على أن تحتفظ وكالة RICH بالمعلومات التي قدّمتها وتستخدمها لترشيحي لفرص التسويق عبر المؤثرين، بما في ذلك مشاركة ملفي وإحصائياتي العامة وأسعاري مع عملاء RICH. يمكنني تحديث بياناتي أو طلب حذف ملفي في أي وقت.',
		submit: 'إرسال التسجيل', saving: 'جارٍ الحفظ…', required: 'الحقول المعلّمة بـ * مطلوبة.',
		doneT: 'شكراً لك، تم تسجيلك', doneD: 'سيراجع فريقنا ملفك قريباً. يمكنك تسجيل الدخول في أي وقت لتحديث بياناتك.', goProfile: 'عرض ملفي',
		loginT: 'الدخول إلى ملفك', loginD: 'استخدم البريد الإلكتروني وكلمة المرور التي سجّلت بها.', password2: 'كلمة المرور', noAcc: 'لم تسجّل بعد؟', regLink: 'انضم إلى الشبكة',
		st_pending: 'ملفك قيد المراجعة من فريق RICH.', st_approved: 'ملفك منشور في شبكة RICH للمؤثرين.',
		st_info_requested: 'يحتاج فريق RICH إلى بعض التفاصيل الإضافية:', st_rejected: 'لم تتم الموافقة على تسجيلك هذه المرة. يمكنك تحديث ملفك وإعادة إرساله.',
		save: 'حفظ التغييرات', resubmit: 'حفظ وإعادة الإرسال', saved: 'تم الحفظ.', savedReview: 'تم الحفظ. تظهر تغييرات المتابعين والأسعار والحسابات والفئات بعد مراجعة فريق RICH.',
		pendingNote: 'بانتظار المراجعة:', changePw: 'تغيير كلمة المرور', current: 'كلمة المرور الحالية', newpw: 'كلمة المرور الجديدة',
		footer: 'وكالة RICH · دبي، الإمارات. تُستخدم معلوماتك فقط لترشيحك لفرص التسويق عبر المؤثرين.',
		errCheck: 'يرجى مراجعة الحقول المحددة.', lang: 'English', atLeastOne: 'أضف اسم مستخدم إنستغرام أو تيك توك واحداً على الأقل.'
	}
};
const CAT_AR = {
	'Lifestyle': 'لايف ستايل', 'Food & Restaurants': 'الطعام والمطاعم', 'Beauty & Skincare': 'الجمال والعناية بالبشرة', 'Fashion': 'الموضة',
	'Motherhood & Parenting': 'الأمومة والتربية', 'Family & Kids': 'العائلة والأطفال', 'Travel': 'السفر', 'Fitness & Wellness': 'اللياقة والصحة',
	'Automotive': 'السيارات', 'Technology': 'التقنية', 'Entertainment': 'الترفيه', 'Luxury': 'الفخامة', 'Home & Interior Design': 'المنزل والديكور',
	'Business & Entrepreneurship': 'الأعمال وريادة الأعمال', 'Education': 'التعليم', 'Gaming': 'الألعاب', 'Sports': 'الرياضة', 'Other': 'أخرى'
};
const CITY_AR = { 'Dubai': 'دبي', 'Abu Dhabi': 'أبوظبي', 'Sharjah': 'الشارقة' };
const LANGS = [['Arabic', 'العربية'], ['English', 'الإنجليزية'], ['Hindi', 'الهندية'], ['Urdu', 'الأردية'], ['French', 'الفرنسية'], ['Russian', 'الروسية'], ['Tagalog', 'التاغالوغية']];
const IG = '<svg viewBox="0 0 24 24" fill="none" stroke="#c13584" stroke-width="2.2"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="#c13584"/></svg>';
const TT = '<svg viewBox="0 0 24 24" fill="#111"><path d="M16.6 5.8A4.3 4.3 0 0 1 15.5 3h-3.1v12.4a2.6 2.6 0 1 1-2.6-2.6c.3 0 .5 0 .8.1V9.7a5.7 5.7 0 1 0 4.9 5.7V9a7.3 7.3 0 0 0 4.3 1.4V7.3a4.3 4.3 0 0 1-3.2-1.5z"/></svg>';

let lang = (() => {
	try { const s = localStorage.getItem('rich_lang'); if (s === 'en' || s === 'ar') return s; } catch {}
	return (navigator.language || '').startsWith('ar') ? 'ar' : 'en';
})();
const t = (k) => T[lang][k] ?? T.en[k] ?? k;
const catName = (n) => (lang === 'ar' && CAT_AR[n]) || n;
let options = null;
let me = null;

async function api(path, opts = {}) {
	const o = { method: opts.method || 'GET', headers: {} };
	if (opts.body instanceof FormData) o.body = opts.body;
	else if (opts.body !== undefined) { o.body = JSON.stringify(opts.body); o.headers['Content-Type'] = 'application/json'; }
	const r = await fetch('/api/join' + path, o);
	const d = await r.json().catch(() => ({}));
	if (!r.ok) { const e = new Error(d.error || 'Something went wrong'); e.data = d; e.status = r.status; throw e; }
	return d;
}

function applyLang() {
	document.documentElement.lang = lang;
	document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
	$('#lang').textContent = t('lang');
	$('#foot').textContent = t('footer');
	$('#toplink').textContent = me ? t('logout') : location.hash.startsWith('#/login') ? t('register') : t('login');
	$('#toplink').href = me ? '#/logout' : location.hash.startsWith('#/login') ? '#/' : '#/login';
}
$('#lang').onclick = () => {
	// Keep anything typed in the form across the language switch.
	const snapshot = root.querySelector('form') ? collect(root.querySelector('form')) : null;
	lang = lang === 'en' ? 'ar' : 'en';
	try { localStorage.setItem('rich_lang', lang); } catch {}
	route(snapshot);
};

// ---------- form ----------
const lbl = (k, req, optional) => `<span class="${req ? 'req' : ''}">${t(k)}${optional ? ` <span class="opt">(${t('optional')})</span>` : ''}</span>`;
const inp = (name, v, attrs = '') => `<input type="text" name="${name}" value="${esc(v ?? '')}" ${attrs}>`;
const num = (name, v) => `<input type="text" inputmode="decimal" name="${name}" value="${esc(v ?? '')}" class="ltr">`;
const money = (name, v) => `<div class="money"><input type="text" inputmode="numeric" name="${name}" value="${esc(v ?? '')}" class="ltr"><i>AED</i></div>`;

function formHtml(p, mode) {
	const cats = options.categories;
	const primary = (p.categories || []).find((c) => c.primary)?.id || p.primary_category || '';
	const extraIds = new Set((p.categories || []).map((c) => c.id || c).filter((id) => +id !== +primary));
	const city = p.city || '';
	const knownCity = ['Dubai', 'Abu Dhabi', 'Sharjah'].includes(city);
	const langsSel = new Set(p.languages || []);
	const otherLangs = [...langsSel].filter((l) => !LANGS.some(([en]) => en === l)).join(', ');
	const photo = p.photo || '';
	return `<form id="rf" novalidate>
		<div class="step"><span class="n">1</span><div><h2>${t('s1')}</h2><p>${t('s1d')}</p></div></div>
		<div class="photo-pick">${photo ? `<img class="avatar" id="pv" src="${esc(photo)}">` : '<div class="avatar" id="pv">+</div>'}
			<div><label class="btn ghost">${t('photoBtn')}<input type="file" name="photo" accept="image/jpeg,image/png,image/webp" hidden id="photo"></label><div class="faint small" style="margin-top:6px">${t('photoHint')}</div><div class="err" data-err="photo"></div></div></div>
		<div class="grid2" style="margin-top:16px">
			<label class="f" data-f="full_name">${lbl('full_name', 1)}${inp('full_name', p.full_name, 'autocomplete="name"')}</label>
			<label class="f" data-f="email">${lbl('email', 1)}<input type="email" name="email" value="${esc(p.email || '')}" autocomplete="email"></label>
			<label class="f" data-f="whatsapp">${lbl('whatsapp', 1)}<input type="tel" name="whatsapp" value="${esc(p.whatsapp || '')}" placeholder="+971 5X XXX XXXX" class="ltr" autocomplete="tel"></label>
			<label class="f" data-f="city">${lbl('city', 1)}<select name="city_pick" id="citypick"><option value="">${t('choose')}</option>${['Dubai', 'Abu Dhabi', 'Sharjah'].map((c) => `<option value="${c}" ${city === c ? 'selected' : ''}>${lang === 'ar' ? CITY_AR[c] : c}</option>`).join('')}<option value="__other" ${city && !knownCity ? 'selected' : ''}>${t('otherCity')}</option></select>
				<input type="text" name="city_other" id="cityother" value="${esc(knownCity ? '' : city)}" placeholder="${t('otherCity')}" style="margin-top:6px" class="${city && !knownCity ? '' : 'hidden'}"></label>
			<label class="f">${lbl('gender', 0, 1)}<select name="gender"><option value="">${t('choose')}</option>${['female', 'male', 'other'].map((g) => `<option value="${g}" ${p.gender === g ? 'selected' : ''}>${t(g)}</option>`).join('')}</select></label>
			<label class="f">${lbl('nationality', 0, 1)}${inp('nationality', p.nationality)}</label>
		</div>
		<label class="f" style="margin-top:12px">${lbl('languages')}<div class="chips" id="langs">${LANGS.map(([en, ar]) => `<span class="chip ${langsSel.has(en) ? 'on' : ''}" data-v="${en}">${lang === 'ar' ? ar : en}</span>`).join('')}</div>
			<input type="text" name="lang_other" value="${esc(otherLangs)}" placeholder="${t('otherLang')}" style="margin-top:8px;max-width:300px"></label>
		<label class="f" style="margin-top:12px">${lbl('agency', 0, 1)}${inp('agency', p.agency, `placeholder="${t('agencyHint')}"`)}</label>

		<div class="step"><span class="n">2</span><div><h2>${t('s2')}</h2><p>${t('s2d')}</p></div></div>
		<div class="grid2">
			<label class="f" data-f="primary_category">${lbl('primary', 1)}<select name="primary_category" id="primarycat"><option value="">${t('choose')}</option>${cats.map((c) => `<option value="${c.id}" ${+primary === c.id ? 'selected' : ''}>${esc(catName(c.name))}</option>`).join('')}</select></label>
			<label class="f">${lbl('availability')}<select name="availability">${['available', 'limited', 'unavailable', 'unknown'].map((a) => `<option value="${a}" ${(p.availability || 'available') === a ? 'selected' : ''}>${t('av_' + a)}</option>`).join('')}</select></label>
		</div>
		<label class="f" style="margin-top:12px">${lbl('extra', 0, 1)}<div class="chips" id="extracats">${cats.map((c) => `<span class="chip ${extraIds.has(c.id) ? 'on' : ''} ${+primary === c.id ? 'hidden' : ''}" data-v="${c.id}">${esc(catName(c.name))}</span>`).join('')}</div></label>
		<div class="grid2" style="margin-top:12px">
			<label class="f">${lbl('bio', 0, 1)}<textarea name="bio" placeholder="${t('bioPh')}">${esc(p.bio || '')}</textarea></label>
			<label class="f">${lbl('ctypes', 0, 1)}<textarea name="content_types" placeholder="${t('ctypesPh')}">${esc(p.content_types || '')}</textarea></label>
		</div>

		<div class="step"><span class="n">3</span><div><h2>${t('s3')}</h2><p>${t('s3d')}</p></div></div>
		<div class="grid2">${['ig', 'tt'].map((pl) => `<div class="platcard"><h3>${pl === 'ig' ? IG : TT} ${t(pl)}</h3>
			<label class="f" data-f="${pl}_username">${lbl('username')}<div class="prefix"><i>@</i><input type="text" name="${pl}_username" value="${esc(p[pl + '_username'] || '')}" class="ltr" autocapitalize="off" spellcheck="false"></div></label>
			<div class="grid2" style="margin-top:10px">
				<label class="f">${lbl('followers')}${num(pl + '_followers', p[pl + '_followers'])}</label>
				<label class="f">${lbl('er', 0, 1)}${num(pl + '_er', p[pl + '_er'])}</label>
				<label class="f" style="grid-column:1/-1">${lbl(pl === 'ig' ? 'views_ig' : 'views_tt', 0, 1)}${num(pl + '_avg_views', p[pl + '_avg_views'])}</label>
			</div>
			<details style="margin-top:10px"><summary class="small" style="cursor:pointer;color:var(--accent-ink);font-weight:600">${t('moreStats')}</summary>
				<div class="grid2" style="margin-top:10px"><label class="f">${lbl('likes')}${num(pl + '_avg_likes', p[pl + '_avg_likes'])}</label><label class="f">${lbl('comments')}${num(pl + '_avg_comments', p[pl + '_avg_comments'])}</label></div></details>
		</div>`).join('')}</div>
		<div class="err" data-err="ig_username"></div>

		<div class="step"><span class="n">4</span><div><h2>${t('s4')}</h2><p>${t('s4d')}</p></div></div>
		<div class="grid3">${[['price_ig_reel', 'r_reel'], ['price_ig_story', 'r_story'], ['price_ig_post', 'r_post'], ['price_ig_carousel', 'r_carousel'], ['price_tt_video', 'r_tt'], ['price_tt_live', 'r_live'], ['price_package', 'r_pkg']]
			.map(([k, l]) => `<label class="f">${lbl(l)}${money(k, p[k])}</label>`).join('')}</div>

		${mode === 'register' ? `<div class="step"><span class="n">5</span><div><h2>${t('s5')}</h2><p>${t('s5d')}</p></div></div>
		<label class="f" data-f="password" style="max-width:340px">${lbl('password', 1)}<input type="password" name="password" autocomplete="new-password" minlength="8"><span class="faint small">${t('passHint')}</span></label>
		<label class="consent" data-f="consent" style="margin-top:18px"><input type="checkbox" name="consent" ${p.consent ? 'checked' : ''}><span class="req">${t('consent')}</span></label>
		<input type="text" name="website" tabindex="-1" autocomplete="off" style="position:absolute;width:1px;height:1px;opacity:0;overflow:hidden;clip:rect(0 0 0 0);border:0;padding:0" aria-hidden="true">` : ''}

		<div class="submitbar"><button class="btn accent" id="submit">${mode === 'register' ? t('submit') : p.status === 'approved' ? t('save') : t('resubmit')}</button><span class="faint small">${t('required')}</span></div>
		<div class="err" id="formerr" style="font-size:14px"></div>
	</form>`;
}

function bindForm(form) {
	const pick = $('#citypick', form), other = $('#cityother', form);
	pick.onchange = () => other.classList.toggle('hidden', pick.value !== '__other');
	$('#langs', form).onclick = (e) => { const c = e.target.closest('.chip'); if (c) c.classList.toggle('on'); };
	$('#extracats', form).onclick = (e) => { const c = e.target.closest('.chip'); if (c) c.classList.toggle('on'); };
	$('#primarycat', form).onchange = (e) => $$('#extracats .chip', form).forEach((c) => c.classList.toggle('hidden', c.dataset.v === e.target.value));
	$('#photo', form).onchange = (e) => {
		const f = e.target.files[0]; if (!f) return;
		const pv = $('#pv', form);
		const img = document.createElement('img'); img.className = 'avatar'; img.id = 'pv'; img.src = URL.createObjectURL(f);
		pv.replaceWith(img);
	};
}

function collect(form) {
	const fd = new FormData(form);
	const d = {};
	for (const k of ['full_name', 'email', 'whatsapp', 'gender', 'nationality', 'agency', 'bio', 'content_types', 'availability',
		'ig_username', 'ig_followers', 'ig_er', 'ig_avg_views', 'ig_avg_likes', 'ig_avg_comments',
		'tt_username', 'tt_followers', 'tt_er', 'tt_avg_views', 'tt_avg_likes', 'tt_avg_comments',
		'price_ig_reel', 'price_ig_story', 'price_ig_post', 'price_ig_carousel', 'price_tt_video', 'price_tt_live', 'price_package']) d[k] = (fd.get(k) || '').toString().trim();
	const cp = fd.get('city_pick');
	d.city = cp === '__other' ? (fd.get('city_other') || '').toString().trim() : cp || '';
	d.languages = [...$$('#langs .chip.on', form).map((c) => c.dataset.v), ...String(fd.get('lang_other') || '').split(',').map((s) => s.trim()).filter(Boolean)];
	d.primary_category = +fd.get('primary_category') || null;
	d.categories = [d.primary_category, ...$$('#extracats .chip.on:not(.hidden)', form).map((c) => +c.dataset.v)].filter(Boolean);
	d.consent = !!fd.get('consent');
	return { data: d, password: fd.get('password'), photo: fd.get('photo'), website: fd.get('website') };
}

function clientCheck(c, mode) {
	const d = c.data; const f = {};
	const L = lang === 'ar';
	if (!d.full_name) f.full_name = L ? 'مطلوب' : 'Required';
	if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) f.email = L ? 'بريد إلكتروني غير صالح' : 'Enter a valid email';
	if (d.whatsapp.replace(/\D/g, '').length < 7) f.whatsapp = L ? 'رقم غير صالح' : 'Enter a valid number';
	if (!d.city) f.city = L ? 'مطلوب' : 'Required';
	if (!d.primary_category) f.primary_category = L ? 'مطلوب' : 'Required';
	if (!d.ig_username && !d.tt_username) f.ig_username = t('atLeastOne');
	if (mode === 'register') {
		if (String(c.password || '').length < 8) f.password = t('passHint');
		if (!d.consent) f.consent = L ? 'مطلوب' : 'Required';
	}
	return f;
}

function showErrors(form, fields) {
	$$('.has-err', form).forEach((x) => x.classList.remove('has-err'));
	$$('.err[data-err]', form).forEach((x) => (x.textContent = ''));
	$$('.ferr', form).forEach((x) => x.remove());
	let first = null;
	for (const [k, msg] of Object.entries(fields || {})) {
		const box = $(`[data-err="${k}"]`, form);
		if (box) { box.textContent = msg; first = first || box; continue; }
		const l = $(`[data-f="${k}"]`, form);
		if (l) { l.classList.add('has-err'); l.insertAdjacentHTML('beforeend', `<div class="err ferr">${esc(msg)}</div>`); first = first || l; }
	}
	if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function submitForm(form, mode) {
	const c = collect(form);
	const fields = clientCheck(c, mode);
	$('#formerr').textContent = '';
	if (Object.keys(fields).length) { showErrors(form, fields); $('#formerr').textContent = t('errCheck'); return null; }
	showErrors(form, {});
	const fd = new FormData();
	fd.append('data', JSON.stringify(c.data));
	if (c.photo && c.photo.size) fd.append('photo', c.photo);
	if (mode === 'register') { fd.append('password', c.password); fd.append('website', c.website || ''); }
	const btn = $('#submit'); const label = btn.textContent; btn.disabled = true; btn.textContent = t('saving');
	try {
		return await api(mode === 'register' ? '/register' : '/me', { method: mode === 'register' ? 'POST' : 'PUT', body: fd });
	} catch (e) {
		showErrors(form, e.data?.fields);
		$('#formerr').innerHTML = esc(e.message) + (e.data?.login ? ` <a href="#/login">${t('login')}</a>` : '');
		return null;
	} finally { btn.disabled = false; btn.textContent = label; }
}

// ---------- views ----------
function hero() {
	return `<section class="hero"><div class="jwrap"><h1>${t('hero1')}</h1><p>${t('hero2')}</p>
		<div class="perks"><div class="perk"><b>${t('perk1')}</b><span>${t('perk1d')}</span></div><div class="perk"><b>${t('perk2')}</b><span>${t('perk2d')}</span></div><div class="perk"><b>${t('perk3')}</b><span>${t('perk3d')}</span></div></div></div></section>`;
}

function viewRegister(snapshot) {
	if (me) { location.hash = '#/profile'; return; }
	const p = snapshot ? { ...snapshot.data, categories: snapshot.data.categories.map((id) => ({ id, primary: id === snapshot.data.primary_category })) } : {};
	root.innerHTML = hero() + `<div class="jwrap"><div class="card jcard">${formHtml(p, 'register')}</div></div>`;
	const form = $('#rf');
	bindForm(form);
	form.onsubmit = async (e) => {
		e.preventDefault();
		const r = await submitForm(form, 'register');
		if (!r) return;
		me = true;
		root.innerHTML = `<div class="jwrap" style="padding-top:40px"><div class="card done"><div class="big">✓</div><h2>${t('doneT')}</h2><p class="muted">${t('doneD')}</p><a class="btn" href="#/profile">${t('goProfile')}</a></div></div>`;
		applyLang();
		window.scrollTo(0, 0);
	};
}

function viewLogin() {
	root.innerHTML = `<div class="jwrap" style="padding-top:40px;max-width:440px"><form class="card pad stack" id="lf">
		<h2 style="margin:0">${t('loginT')}</h2><p class="muted" style="margin:0">${t('loginD')}</p>
		<label class="f"><span>${t('email')}</span><input type="email" name="email" autocomplete="username" required></label>
		<label class="f"><span>${t('password2')}</span><input type="password" name="password" autocomplete="current-password" required></label>
		<div class="err" id="le"></div>
		<button class="btn" style="width:100%;justify-content:center">${t('login')}</button>
		<p class="small muted" style="margin:0">${t('noAcc')} <a href="#/">${t('regLink')}</a></p></form></div>`;
	$('#lf').onsubmit = async (e) => {
		e.preventDefault();
		try { await api('/login', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) }); me = true; location.hash = '#/profile'; }
		catch (er) { $('#le').textContent = er.message; }
	};
}

async function viewProfile(snapshot) {
	let r;
	try { r = await api('/me'); } catch (e) { me = null; applyLang(); location.hash = '#/login'; return; }
	me = true; applyLang();
	const p = snapshot ? { ...r.profile, ...snapshot.data, categories: snapshot.data.categories.map((id) => ({ id, primary: id === snapshot.data.primary_category })) } : r.profile;
	const st = r.profile.status;
	root.innerHTML = `<div class="jwrap" style="padding-top:30px">
		<div class="statusbox ${st}"><b>${t('st_' + st)}</b>${st === 'info_requested' && r.profile.info_request ? `<div style="margin-top:6px;white-space:pre-line">${esc(r.profile.info_request)}</div>` : ''}
		${r.pending_update ? `<div class="small" style="margin-top:6px">${t('pendingNote')} ${esc(r.pending_update.fields.join(', '))}</div>` : ''}</div>
		<div class="card pad">${formHtml(p, 'profile')}</div>
		<details class="card pad" style="margin-top:18px"><summary style="cursor:pointer;font-weight:600">${t('changePw')}</summary>
			<div class="grid2" style="margin-top:12px"><input type="password" id="pw1" placeholder="${t('current')}"><input type="password" id="pw2" placeholder="${t('newpw')}"></div>
			<button class="btn sm" id="pwgo" style="margin-top:10px">${t('changePw')}</button><span class="small" id="pwmsg" style="margin-inline-start:10px"></span></details>
	</div>`;
	const form = $('#rf');
	bindForm(form);
	form.onsubmit = async (e) => {
		e.preventDefault();
		const res = await submitForm(form, 'profile');
		if (!res) return;
		await viewProfile();
		const box = $('.statusbox');
		box.insertAdjacentHTML('afterend', `<div class="banner ok" style="margin-bottom:18px">${res.review ? t('savedReview') : t('saved')}</div>`);
		window.scrollTo(0, 0);
	};
	$('#pwgo').onclick = async () => {
		try { await api('/password', { method: 'POST', body: { current: $('#pw1').value, next: $('#pw2').value } }); $('#pwmsg').textContent = t('saved'); }
		catch (e) { $('#pwmsg').textContent = e.message; }
	};
}

async function route(snapshot) {
	if (!options) options = await api('/options');
	const h = location.hash || '#/';
	applyLang();
	if (h.startsWith('#/logout')) { await api('/logout', { method: 'POST' }).catch(() => {}); me = null; location.hash = '#/login'; return; }
	if (h.startsWith('#/login')) viewLogin();
	else if (h.startsWith('#/profile')) await viewProfile(snapshot);
	else viewRegister(snapshot);
	applyLang();
}
window.addEventListener('hashchange', () => route());

(async () => {
	try { await api('/me'); me = true; } catch { me = null; }
	if (me && (!location.hash || location.hash === '#/')) location.hash = '#/profile';
	else route();
})();
})();
