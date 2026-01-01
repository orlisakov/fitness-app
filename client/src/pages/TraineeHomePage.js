// src/pages/TraineeHomePage.js
import React from "react";
// אם יש לך תמונות – עדכני את הנתיבים:
import coachMain from "../assets/couch.jpg"; // תמונה יפה של איב
import coachBeforeAfter from "../assets/coach-before-after.jpg"; // לפני / אחרי (לא חובה)

export default function TraineeHomePage() {
  return (
    <div className="coach-intro-page training-program-page" dir="rtl">
      {/* HERO – פתיח */}
      <section className="coach-hero">
        <div className="coach-hero-image-wrap">
          {/* אם עדיין אין תמונה, אפשר להשאיר div ריק עם רקע */}
          {coachMain ? (
            <img
              src={coachMain}
              alt="איב – מאמנת הכושר"
              className="coach-hero-image"
            />
          ) : (
            <div className="coach-hero-placeholder">תמונה של איב</div>
          )}
        </div>

        <div className="coach-hero-text">
          <p className="coach-eyebrow">תכירי את איב</p>
          <h1 className="coach-title">
            המאמנת שעברה את כל הדרך על בשרה –
            <br />
            ועכשיו מלווה אותך לשינוי שלא נגמר אחרי דיאטה אחת.
          </h1>
          <p className="coach-lead">
            אני לא רק מאמנת כושר – אני אישה שחיה כל תהליך עם הלב והבטן. אני לא
            שוכחת לרגע איך זה מרגיש להיות בצד השני, מול המראה, עם עודף משקל ועם
            לב שמבקר אותך לפני שיצאת מהבית.
          </p>
        </div>
      </section>

      {/* מי אני? */}
      <section className="coach-section">
        <h2 className="coach-section-title">מי אני?</h2>
        <div className="coach-card">
          <p>אני איב.</p>
          <p>
            ואני לא רק מאמנת כושר – אני אישה שחיה כל תהליך עם הלב והבטן. אני לא
            שוכחת לרגע איך זה מרגיש להיות בצד השני.
          </p>
          <p>
            שקלתי <strong>120 קילו</strong>. לא אהבתי את עצמי. לא האמנתי שמגיע
            לי אחרת. שנאתי את מה שראיתי במראה, התביישתי בגוף שלי. אוכל היה
            בשבילי הכול – שמחה, נחמה, ענישה ופיצוי.
          </p>
          <p>
            כשהבנתי שהחיים שלי מנוהלים על ידי אוכל – ולא על ידי אהבה לעצמי –
            התחלתי לשנות. עשיתי את כל הדרך בלי ניתוחים, בלי קיצורי דרך – רק עם
            רצון, משמעת והתמדה. ירדתי <strong>60 קילו</strong> – אבל מה שהשתנה
            באמת, זו אני.
          </p>
          <p>
            הרגע הכי כואב – והכי משנה חיים – קרה בבית. ליאם, הבת שלי, הגיעה לגיל
            14 עם 140 קילו, וראיתי עליה את כל מה שאני ניסיתי להחביא. רק אחרי
            ששיניתי את עצמי הצלחתי לעזור גם לה. שם הבנתי – זו לא רק הדרך שלי.{" "}
            <strong>זו השליחות שלי.</strong>
          </p>
          <p>
            היום אני מלווה עשרות נשים ונערות – כל אחת עם הסיפור שלה, עם הקושי
            שלה, ועם הכאב שהיא סוחבת כבר שנים. נשים שהצליחו לשנות לא רק את הגוף
            – אלא את כל מה שהן מרגישות כלפיו. נשים שלמדו מחדש איך לדבר לעצמן
            ואיך לבחור בעצמן.
          </p>
          <p className="coach-quote">
            אני לא עושה דיאטות. אני לא מאמינה בפתרונות זמניים. אני מלמדת{" "}
            <strong>דרך חיים אחרת</strong> – כזו שאפשר להתמיד בה, לאהוב אותה,
            ולהרגיש בתוכה חופשיה באמת.
          </p>
          <p className="coach-quote">
            כי שינוי אמיתי לא מתחיל בצלחת – הוא מתחיל בזה שאת בוחרת בעצמך.
          </p>
        </div>
      </section>

      {/* לפני / אחרי – אופציונלי */}
      <section className="coach-section coach-section--highlight">
        <div className="coach-before-after">
          {coachBeforeAfter ? (
            <img
              src={coachBeforeAfter}
              alt="לפני ואחרי – המסע של איב"
              className="coach-before-after-image"
            />
          ) : (
            <div className="coach-before-after-placeholder">
              כאן אפשר לשים תמונת לפני/אחרי
            </div>
          )}

          <div className="coach-before-after-text">
            <h3>מהפך שמתחיל מבפנים</h3>
            <p>
              התמונה הזו היא לא רק מספרים על המשקל. היא מזכירה לי כל יום את
              הילדה שהייתי – ואת האישה שבחרתי להיות. לא מושלמת, אבל שלמה. לא על
              דיאטה, אלא בדרך חיים.
            </p>
            <p>
              ואם אני הצלחתי מתוך 120 קילו, דיכאון, בושה וחוסר אמונה – גם את
              יכולה. אני כאן כדי לוודא שאת לא עושה את זה לבד.
            </p>
          </div>
        </div>
      </section>

      {/* למה לבחור בי? */}
      <section className="coach-section">
        <div className="coach-card coach-card--list">
          <p>
            אני <strong>לא עוד מאמנת</strong>. אני מבינה איך הראש של אישה עם
            עודף משקל באמת עובד.
          </p>

          <ul className="coach-list">
            <li>
              אני מכירה את המאבק מבפנים – את התשוקה הרגעית לאוכל, את האכילה הלא
              נשלטת כשאף אחד לא רואה, ואת ההבטחות שמתחילות כל פעם מחדש ב “יום
              ראשון דיאטה” ונגמרות באכזבה מעצמך.
            </li>
            <li>
              אני לא עושה לך עוד דיאטה – אני מלמדת אותך איך לשלוט באכילה, ולא
              לתת לאוכל לנהל אותך.
            </li>
            <li>
              אנחנו בונות יחד הרגלים שמחזיקים גם כשאין כוח וגם כשאין חשק – כי הם
              בנויים על הבנה, לא על מאבק.
            </li>
            <li>
              אני לא שולפת תוכנית מהמדף. אנחנו בונות{" "}
              <strong>דרך מותאמת אישית</strong> – למי שאת, לחיים שלך, ולמה שאת
              באמת צריכה.
            </li>
            <li>
              יש לך ליווי צמוד, סבלני ומכיל – ממישהי שהייתה בדיוק במקומות שהיית
              בהם ויודעת איך להוציא אותך מהם.
            </li>
          </ul>

          <p className="coach-quote">
            כשיש לידך מישהי שמכירה את המקומות שהיית בהם ויודעת ללוות אותך באהבה
            ועם זמינות 24/7 – הפעם זה לא ייגמר כמו כל פעם.
            <br />
            <strong>הפעם – את תצליחי.</strong>
          </p>
        </div>
      </section>

      {/* גלריית שינויים אמיתיים */}
      <section className="coach-section coach-gallery-section">
        <h2 className="coach-section-title">שינויים אמיתיים מהתהליכים</h2>

        <p className="coach-gallery-subtitle">
          חלק קטן מהנשים שעברו איתי תהליך והפכו לחזקות, בריאות ובטוחות יותר
          בעצמן 💗
        </p>

        <div className="coach-gallery-grid">
          {/* תני שם קבצים אמיתיים לתמונות האלה */}
          <img
            src={require("../assets/gallery1.jpg")}
            alt="שינוי מתאמנת"
            loading="lazy"
          />
          <img
            src={require("../assets/gallery2.jpg")}
            alt="שינוי מתאמנת"
            loading="lazy"
          />
          <img
            src={require("../assets/gallery3.jpg")}
            alt="שינוי מתאמנת"
            loading="lazy"
          />
          <img
            src={require("../assets/gallery4.jpg")}
            alt="שינוי מתאמנת"
            loading="lazy"
          />
          <img
            src={require("../assets/gallery5.jpg")}
            alt="שינוי מתאמנת"
            loading="lazy"
          />
          <img
            src={require("../assets/gallery6.jpg")}
            alt="שינוי מתאמנת"
            loading="lazy"
          />
          <img
            src={require("../assets/gallery8.jpg")}
            alt="שינוי מתאמנת"
            loading="lazy"
          />
          <img
            src={require("../assets/gallery10.jpg")}
            alt="שינוי מתאמנת"
            loading="lazy"
          />
          <img
            src={require("../assets/gallery11.jpg")}
            alt="שינוי מתאמנת"
            loading="lazy"
          />
          <img
            src={require("../assets/gallery12.jpg")}
            alt="שינוי מתאמנת"
            loading="lazy"
          />
          <img
            src={require("../assets/gallery13.jpg")}
            alt="שינוי מתאמנת"
            loading="lazy"
          />
          <img
            src={require("../assets/gallery14.jpg")}
            alt="שינוי מתאמנת"
            loading="lazy"
          />
        </div>
      </section>

      {/* סיום / קריאה לפעולה */}
      <section className="coach-section coach-section--center">
        <p className="coach-ending">
          אם את קוראת את זה ומרגישה שזה מדבר אלייך, זה סימן שהלב שלך כבר עשה צעד
          ראשון.
          <br />
          בואי נעשה את הצעד הבא – יחד.
        </p>

        {/* אם יש כפתור ליצירת קשר / הצטרפות – חיבור לכפתור קיים */}
        {/* <button className="gradient-button">אני רוצה להתחיל תהליך</button> */}
      </section>
    </div>
  );
}
