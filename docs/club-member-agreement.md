# Club member agreement (paper form)

The paper agreement every member signs at the club, received from the project owners on 2026-11-25. Photo: [`club-member-agreement.jpg`](club-member-agreement.jpg). It is the club's own text; the system must record that a member signed it, and it is the base for the virtual version.

It is a set of club rules plus a liability waiver. It does **not** contain the personal-data information that Ley 25.326 requires (see [`member-consent-draft.md`](member-consent-draft.md)); the two texts are signed together or the data clause is added to this form.

## Transcription (Spanish, as written)

> **ACUERDO CLUB INDEPENDIENTE**
>
> - La cuota se abona del 1 al 10 SIN recargo, 11 al 15 un recargo de $3000, del 16 al 20 un recargo de $5000 y del 21 al 30 un recargo de $7000.
> - Los socios que adeuden una o más cuotas NO podrán realizar la actividad, la cuota se cobrará con monto actualizado.
> - En caso que el socio no asista al deporte por un mes deberá abonar CUOTA SOCIAL, a partir de los dos meses de inasistencia deberá abonar reinscripción y cuota del mes que se incorpora.
> - Es OBLIGATORIO QUE SE PRESENTE EN RECEPCIÓN EL CARNET DE SOCIO PARA REALIZAR LA ACTIVIDAD.
> - Una vez finalizada la actividad el club NO SE RESPONSABILIZA de lo que le suceda al socio dentro y fuera de la institución, quedando a cargo de los padres o tutores los daños materiales que se puedan generar por el socio en el club.
>
> FIRMA
> ACLARACIÓN
> CELULAR

## Rules it states, and how they compare with the handoff

| Rule in the agreement | Current rule in [`team-handoff.md`](team-handoff.md) | Status |
| --- | --- | --- |
| Surcharges: days 1–10 none, 11–15 `$3,000`, 16–20 `$5,000`, 21–30 `$7,000`. | Same tiers; day 31 is included in the last tier. | Matches. |
| A member who owes one or more fees cannot do the activity. | Access control already uses the member's standing. | Check that a debtor is refused at the entrance. |
| An owed fee is charged at the **updated** amount. | Each overdue month is charged at the tariff **in force that month**. | **Settled 2026-11-26:** owed fees are charged at the tariff in force on the payment date. |
| One month without attending: the member pays the social fee only. | Social fee and activity fee are charged every month. | **Settled 2026-11-26:** the secretary marks the month "sin actividad" by hand; it then owes only the social fee. The system does not infer absence. |
| Two or more months without attending: re-enrollment fee plus the fee of the month they return. | More than 3 **unpaid** months means deregistration and full re-enrollment. | **Settled 2026-11-26:** deregistration stays payment-based, with the threshold lowered to 2 unpaid months and made an editable parameter. Absence alone does not deregister. |
| The member carnet must be shown at reception to do the activity. | The entrance checks members by DNI or face. | **Settled 2026-11-26:** reception checks the carnet by hand; the system does not ask for it. |
| Liability waiver; parents or tutors answer for damage caused by minors. | Not in the system. | Text only; record the signature. |
| Signature, printed name and mobile phone. | Member record has a phone. | The mobile is the WhatsApp number for notices. |
