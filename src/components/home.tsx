import Image from "next/image";
import { siteAsset } from "@/lib/site-assets";
import Link from "next/link";
import { copy, faqs, services, type Locale } from "@/lib/content";
import { Icon, type IconName } from "./icon";
import { Reveal } from "./reveal";
import { articleCover } from "./article-content";
export function Home({
  locale,
  content,
  branding,
  articles = [],
}: {
  locale: Locale;
  content?: (typeof copy)[Locale];
  branding?: Record<string, unknown> | null;
  articles?: Array<{
    id: string;
    slug: string;
    title: string;
    body?: string;
    description: string | null;
  }>;
}) {
  const t = content || copy[locale];
  const fa = locale === "fa";
  const booking = `/${locale}/booking`;
  return (
    <main id="main">
      <section className="hero">
        <div className="hero-art" aria-hidden="true">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="orbit orbit-three" />
          <span className="floating-plus plus-one">+</span>
          <span className="floating-plus plus-two">+</span>
        </div>
        <div className="hero-copy">
          <div className="eyebrow hero-eyebrow">
            <span className="status-dot" />
            {t.eyebrow}
          </div>
          <h1>
            {t.hero1}
            <br />
            <span>{t.hero2}</span>
            <svg
              className="hero-underline"
              viewBox="0 0 330 18"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M5 12C86 2 218 0 325 10"
                stroke="currentColor"
                strokeWidth="5"
                strokeLinecap="round"
              />
            </svg>
          </h1>
          <p>{t.heroDesc}</p>
          <div className="hero-buttons">
            <Link className="button" href={booking}>
              {t.online}
              <Icon name="arrow" size={20} />
            </Link>
            <Link href={`/${locale}/about`} className="button button-white">
              {t.meet}
              <Icon name="left" size={17} />
            </Link>
          </div>
          <div className="hero-trust">
            <span>
              <Icon name="shield" size={17} />
              {t.secure}
            </span>
            <span>
              <Icon name="heart" size={17} />
              {t.personal}
            </span>
          </div>
        </div>
        <div className="hero-visual">
          <div className="doctor-photo">
            <Image
              src={siteAsset(branding?.doctorImageUrl, "/images/doctor.jpg")}
              unoptimized={!!branding?.doctorImageUrl}
              alt={t.stock}
              fill
              priority
              sizes="(max-width: 700px) 90vw, 45vw"
            />
            <div className="photo-gradient" />
            <div className="doctor-caption">
              <span className="doctor-icon">
                <Icon name="doctor" size={25} />
              </span>
              <div>
                <strong>{t.name}</strong>
                <span>{t.profession}</span>
              </div>
              <span className="verified-icon">
                <Icon name="check" size={15} />
              </span>
            </div>
          </div>
          <div className="floating-card care-floating">
            <span className="soft-icon">
              <Icon name="heart" size={26} />
            </span>
            <div>
              <strong>
                {fa ? "مراقب سلامتی شما" : "Care for your wellbeing"}
              </strong>
              <span>
                {fa
                  ? "با دقت، با حوصله، با شما"
                  : "Attentive. Thoughtful. Personal."}
              </span>
            </div>
            <span className="mini-pulse">⌁</span>
          </div>
          <div className="floating-card consult-floating">
            <span className="blue-icon">
              <Icon name="message" size={22} />
            </span>
            <div>
              <strong>
                {fa ? "مشاوره، بدون فاصله" : "Care, wherever you are"}
              </strong>
              <span>{fa ? "تلفنی و متنی" : "Phone & text consultations"}</span>
            </div>
          </div>
          <div className="decor-dots" aria-hidden="true" />
        </div>
      </section>
      <div className="trust-strip">
        <span>
          {fa
            ? "مراقبتی که به شما نزدیک‌تر است"
            : "Thoughtful care, closer to you"}
        </span>
        {(["shield", "doctor", "message", "clock"] as IconName[]).map(
          (icon, i) => (
            <div key={icon}>
              <Icon name={icon} size={21} />
              {
                (fa
                  ? [
                      "حریم خصوصی محفوظ",
                      "ارتباط مستقیم با پزشک",
                      "انتخاب روش مشاوره",
                      "پیگیری آسان نوبت",
                    ]
                  : [
                      "Privacy respected",
                      "Talk to your doctor",
                      "Your choice of consultation",
                      "Easy appointment tracking",
                    ])[i]
              }
            </div>
          ),
        )}
      </div>
      <section className="section care-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">
              {fa ? "راهی ساده برای مراقبت بهتر" : "BETTER CARE, WITHIN REACH"}
            </span>
            <h2>{t.care}</h2>
          </div>
          <p>{t.careDesc}</p>
        </div>
        <div className="care-grid consultation-grid">
          {[
            {
              icon: "phone",
              title: t.phone,
              desc: t.phoneDesc,
              img: siteAsset(
                branding?.consultationImageUrl,
                "/images/consultation.jpg",
              ),
              query: "phone",
            },
            {
              icon: "message",
              title: t.text,
              desc: t.textDesc,
              img: siteAsset(branding?.medicalImageUrl, "/images/medical.jpg"),
              query: "text",
            },
          ].map((card, i) => (
            <Link
              href={`${booking}?type=${card.query}`}
              className={`care-card ${i === 1 ? "featured" : ""}`}
              key={card.icon}
            >
              <div className="care-top">
                <span className="care-icon">
                  <Icon name={card.icon as IconName} size={25} />
                </span>
                <span className="round-arrow">
                  <Icon name="arrow" size={20} />
                </span>
              </div>
              <h3>{card.title}</h3>
              <p>{card.desc}</p>
              <div className="care-image">
                <Image
                  src={card.img}
                  unoptimized
                  alt=""
                  fill
                  sizes="(max-width:700px) 90vw, 30vw"
                />
                <span>
                  {t.more}
                  <Icon name="arrow" size={15} />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>
      <section className="section services-section" id="services">
        <div className="section-heading">
          <div>
            <span className="eyebrow">{t.medicalEyebrow}</span>
            <h2>{t.medicalTitle}</h2>
            <p>{t.medicalDesc}</p>
          </div>
          <Link href={`/${locale}/services`} className="text-link">
            {t.allServices}
            <Icon name="arrow" size={18} />
          </Link>
        </div>
        <div className="services-grid">
          {services.map((s, i) => (
            <Link
              href={`/${locale}/services/${s.slug}`}
              className="service-card"
              key={s.slug}
            >
              <div className="service-top">
                <span className="small-icon">
                  <Icon name={s.icon as IconName} size={27} />
                </span>
                <span className="service-number">0{i + 1}</span>
              </div>
              <h3>{s[locale]}</h3>
              <p>{fa ? s.desc : s.enDesc}</p>
              <span className="service-arrow">
                <Icon name="arrow" size={19} />
              </span>
            </Link>
          ))}
        </div>
      </section>
      <Reveal>
        <section className="philosophy">
          <span className="eyebrow">
            {fa ? "نگاه ما به مراقبت" : "OUR APPROACH TO CARE"}
          </span>
          <h2>
            {t.philosophy}
            <br />
            <span>{t.philosophy2}</span>
            <span className="quote-spark" aria-hidden="true">
              ✳
            </span>
          </h2>
          <p>{t.philosophyDesc}</p>
        </section>
      </Reveal>
      <section className="section about-section">
        <div className="about-visual">
          <div className="about-photo">
            <Image
              src={siteAsset(branding?.doctorImageUrl, "/images/doctor.jpg")}
              unoptimized={!!branding?.doctorImageUrl}
              alt={t.stock}
              fill
              sizes="(max-width:700px) 90vw, 45vw"
            />
          </div>
          <div className="about-blue-block">
            <Icon name="doctor" size={40} />
          </div>
          <div className="about-badge">
            <Icon name="shield" size={25} />
            <span>
              {fa ? "توجه به شما،" : "Personal attention,"}
              <strong>{fa ? "در هر قدم" : "every step of the way"}</strong>
            </span>
          </div>
        </div>
        <div className="about-copy">
          <span className="eyebrow">{t.doctorLabel}</span>
          <h2>
            {t.doctorTitle}
            <br />
            {t.doctorTitle2}
          </h2>
          <p>{t.doctorDesc}</p>
          <div className="doctor-signature">
            <strong>{t.name}</strong>
            <span>{t.profession}</span>
          </div>
          <div className="about-values">
            <span>
              <Icon name="check" size={16} />
              {t.personal}
            </span>
            <span>
              <Icon name="check" size={16} />
              {t.follow}
            </span>
          </div>
          <Link className="text-link" href={`/${locale}/about`}>
            {t.doctorButton}
            <Icon name="arrow" size={19} />
          </Link>
        </div>
      </section>
      <section className="section process-section" id="how-it-works">
        <div className="center-heading">
          <span className="eyebrow">{t.processLabel}</span>
          <h2>{t.processTitle}</h2>
          <p>{t.processDesc}</p>
        </div>
        <div className="steps-grid">
          {[t.step1, t.step2, t.step3].map((title, i) => (
            <div className="step" key={title}>
              <span className="step-number">
                {fa ? ["۰۱", "۰۲", "۰۳"][i] : `0${i + 1}`}
              </span>
              <span className="step-icon">
                <Icon
                  name={(["message", "calendar", "doctor"] as IconName[])[i]}
                  size={29}
                />
              </span>
              <h3>{title}</h3>
              <p>{[t.step1Desc, t.step2Desc, t.step3Desc][i]}</p>
            </div>
          ))}
        </div>
        <Link href={booking} className="button">
          {t.online}
          <Icon name="arrow" size={18} />
        </Link>
      </section>
      <section className="section">
        <div className="availability-card">
          <span className="eyebrow">
            {fa ? "زمانی برای رسیدگی به خودتان" : "TIME FOR YOUR WELLBEING"}
          </span>
          <h3>{t.availability}</h3>
          <p>{t.availabilityDesc}</p>
          <Link href={booking} className="text-link" style={{ marginTop: 15 }}>
            {t.book}
            <Icon name="calendar" size={17} />
          </Link>
        </div>
      </section>
      <section className="section journal-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">{t.journal}</span>
            <h2>{t.journalTitle}</h2>
          </div>
          <Link className="text-link" href={`/${locale}/articles`}>
            {fa ? "رفتن به مجله سلامت" : "Visit the journal"}
            <Icon name="arrow" size={18} />
          </Link>
        </div>
        {articles.length > 0 ? (
          <div className="services-grid">
            {articles.slice(0, 3).map((article) => (
              <Link
                className="service-card"
                key={article.id}
                href={`/${locale}/articles/${article.slug}`}
              >
                {article.body && articleCover(article.body) && (
                  <Image
                    src={articleCover(article.body)!.src}
                    alt={articleCover(article.body)!.alt}
                    unoptimized
                    width={1200}
                    height={630}
                    className="article-cover"
                  />
                )}
                <span className="eyebrow">
                  {fa ? "مقاله آموزشی" : "HEALTH ARTICLE"}
                </span>
                <h3>{article.title}</h3>
                <p>{article.description}</p>
              </Link>
            ))}
          </div>
        ) : (
          <div className="journal-preview">
            <div className="journal-photo">
              <Image
                src={siteAsset(
                  branding?.medicalImageUrl,
                  "/images/medical.jpg",
                )}
                unoptimized={!!branding?.medicalImageUrl}
                alt=""
                fill
                sizes="(max-width:700px) 90vw, 40vw"
              />
            </div>
            <div>
              <span className="pill">
                <Icon name="file" size={14} />
                {fa ? "آموزش سلامت" : "HEALTH EDUCATION"}
              </span>
              <h3>{t.journalEmpty}</h3>
              <p>{t.journalEmptyDesc}</p>
              <Link href={`/${locale}/articles`} className="text-link">
                {fa ? "درباره مجله سلامت" : "About the health journal"}
                <Icon name="arrow" size={18} />
              </Link>
            </div>
          </div>
        )}
      </section>
      <section className="section faq-section">
        <div>
          <span className="eyebrow">{t.faq}</span>
          <h2>{t.faqTitle}</h2>
          <p>{t.faqDesc}</p>
          <Link href={`/${locale}/contact`} className="text-link">
            {fa ? "هنوز سؤالی دارید؟" : "Still have a question?"}
            <Icon name="arrow" size={18} />
          </Link>
        </div>
        <div className="faq-list">
          {faqs[locale].map(([q, a], i) => (
            <details key={q} open={i === 0}>
              <summary>
                {q}
                <span>
                  <Icon name="plus" size={18} />
                </span>
              </summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      </section>
      <section className="cta-section">
        <div className="cta-orbit" aria-hidden="true" />
        <span className="cta-star" aria-hidden="true">
          ✳
        </span>
        <div>
          <span className="eyebrow">
            {fa ? "یک قدم برای حال بهتر" : "A STEP TOWARDS FEELING BETTER"}
          </span>
          <h2>
            {t.cta}
            <br />
            {t.cta2}
          </h2>
          <p>{t.ctaDesc}</p>
        </div>
        <Link className="button button-white" href={booking}>
          {t.online}
          <Icon name="arrow" size={20} />
        </Link>
      </section>
    </main>
  );
}
