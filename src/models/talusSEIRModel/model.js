import { integrationMethods, integrate, sum, dotProduct } from './helpers'

import { UFState } from '../../user_facing_states.js';



// [
//     0.0024726231566347743,
//     0.0066928509242848554,
//     0.01798620996209156,
//     0.04742587317756678,
//     0.11920292202211755,
//     0.2689414213699951,
//     0.5,
//     0.7310585786300049,
//     0.8807970779778823,
//     0.9525741268224334,
//     0.9820137900379085,
//     0.9933071490757153,
//     0.9975273768433653,
//     0.9990889488055994,
// ]

// calculate the cumulative effects of each 
// each policy on a given day, accounting 
// for the policy effectiveness ramp up
const getInterventionEffect = (t, interventions, policyRamp) => {
    let interventionEffect = 1
    interventions.forEach(inter => {
        if (t >= inter.day) {
            const daysPassed = Math.floor(t - inter.day)
            let rampEffect = 1
            if (daysPassed < policyRamp.length) {
                rampEffect = policyRamp[daysPassed]
            }
            interventionEffect *= (1 + inter.effect * rampEffect)
        }
    })

    return interventionEffect
}

// R0 = N*((1-f)BA/gA + f((B1/(p1+g1))+(p1/(p1+g1))(B2/(p2+g2)+ (p2/(p2+g2))(B3/(m+g3)))))

// get Rt for a given day, initial conditions (for calculating
// susceptible population) and set of epi parameters
const getRt = (step, day, initial, eP, interventions, policyRamp) =>
    Math.max(initial.population - sum(day), 0) * (
        ((1 - eP.f) * (eP.beta[1] * getInterventionEffect(step, interventions, policyRamp)) / (eP.rho[1] + eP.gamma[1]))
        + (eP.f * (eP.beta[4] * getInterventionEffect(step, interventions, policyRamp)) / (eP.gamma[4]))
        + (eP.rho[1] / (eP.rho[1] + eP.gamma[1])) * (eP.beta[2] / (eP.rho[2] + eP.gamma[2])
            + (eP.rho[2] / (eP.rho[2] + eP.gamma[2])) * (eP.beta[3] / (eP.mu + eP.gamma[3])))
    )

// const getRt = (step, day, initial, eP, interventions, policyRamp) =>
//     Math.max(initial.population - sum(day), 0) *
//     (
//         ((eP.beta[1] * getInterventionEffect(step, interventions, policyRamp)) / (eP.rho[1] + eP.gamma[1]))
//         + (eP.rho[1] / (eP.rho[1] + eP.gamma[1])) * (eP.beta[2] / (eP.rho[2] + eP.gamma[2]))
//         + (eP.rho[2] / (eP.rho[2] + eP.gamma[2])) * (eP.beta[3] / (eP.mu + eP.gamma[3]))
//         * ((eP.beta[4] * getInterventionEffect(step, interventions, policyRamp)) / (eP.gamma[4]))
//     )

// const getRt = (step, day, initial, eP, interventions, policyRamp) =>
//     Math.max(initial.population - sum(day), 0) *
//     (
//         (
//             (eP.beta[1] * getInterventionEffect(step, interventions, policyRamp)) / (eP.rho[1] + eP.gamma[1])
//         )
//         +
//         (eP.rho[1] / (eP.rho[1] + eP.gamma[1])) * (eP.beta[2] / (eP.rho[2] + eP.gamma[2]))
//         +
//         (eP.rho[2] / (eP.rho[2] + eP.gamma[2])) * (eP.beta[3] / (eP.mu + eP.gamma[3]))
//         +
//         (
//             (eP.beta[4] * getInterventionEffect(step, interventions, policyRamp)) / (eP.gamma[4])
//         )
//     )


// const getRt = (step, day, initial, eP, interventions, policyRamp) =>
//     Math.max(initial.population - sum(day), 0) *
//     (
//               ((eP.f) * ((eP.beta[1] * getInterventionEffect(step, interventions, policyRamp)) / (eP.rho[1] + eP.gamma[1])))
//         + ((1 - eP.f) * ((eP.beta[4] * getInterventionEffect(step, interventions, policyRamp)) / (eP.gamma[4])))
//         + (eP.rho[1] / (eP.rho[1] + eP.gamma[1])) * (eP.beta[2] / (eP.rho[2] + eP.gamma[2]))
//         + (eP.rho[2] / (eP.rho[2] + eP.gamma[2])) * (eP.beta[3] / (eP.mu + eP.gamma[3]))
//     )

// the SEIR model itself 
const talusSEIR = ({
    initial,
    interventions,
    epiParams,
}) => {

    // making this two letters just to 
    // make the formulas easier to read
    const eP = epiParams

    const deriv = (t, y0) => {
        const S = Math.max(initial.population - sum(y0), 0)

        const E = y0[0]
        const I1 = y0[1]
        const I2 = y0[2]
        const I3 = y0[3]
        // const R = y0[4]
        // const D = y0[5]
        const A = y0[6]

        const I_all = [I1, I2, I3]

        const interventionEffect = getInterventionEffect(t, interventions, policyRamp)

        const beta_mild = eP.beta[1] * interventionEffect
        const beta_hospitalized = eP.beta[2]
        const beta_icu = eP.beta[3]

        const I_transmission = dotProduct(
            [
                beta_mild,
                beta_hospitalized,
                beta_icu
            ],
            I_all)

        const I_recovery = dotProduct(eP.gamma.slice(1, 4), I_all)
        const A_transmission = A * eP.beta_A * interventionEffect
        const A_recovery = A * eP.gamma_A
        const all_infected = sum(I_all) + A
        const percent_asymp = eP.f

        // Exposed
        const dE = Math.min((A_transmission + I_transmission) * S, S) - (eP.alpha * E)

        // asymp
        const dA = (percent_asymp * eP.alpha * E) - (eP.gamma_A * A)

        // Ia - Mildly ill
        const dI1 = ((1 - percent_asymp) * eP.alpha * E) - (eP.gamma[1] + eP.rho[1]) * I1

        // Ib - Hospitalized
        const dI2 = (eP.rho[1] * I1) - (eP.gamma[2] + eP.rho[2]) * I2

        // Ic - ICU
        const dI3 = (eP.rho[2] * I2) - ((eP.gamma[3] + eP.mu) * I3)

        // Recovered
        const dR = Math.min(A_recovery + I_recovery, all_infected)

        // Deaths
        const dD = eP.mu * I3

        return [dE, dI1, dI2, dI3, dR, dD, dA]
    }

    // results aray
    const days = []

    // initial conditions
    let day = [
        initial.exposed,
        initial.mild,
        initial.hospitalized,
        initial.icu,
        initial.recovered,
        initial.dead,
        initial.asymp,
    ]

    const initialDay = day

    // percentage of the total policy
    // effectiveness for the first n days 
    // of the policy. 
    const policyRamp = []
    for (let step = 0; step < initial.policyRampDays; step++) {
        if (initial.logisticRamp) {
            policyRamp.push(1 / (1 + Math.exp(-1 * (step - initial.policyRampDays / 2))))
        } else {
            policyRamp.push(step / initial.policyRampDays)
        }
    }

    console.log(policyRamp)

    const r0 = getRt(0, day, initial, eP, interventions, policyRamp)

    // loop through each step of the model 
    for (let step = 0; step <= initial.days_to_model; step += initial.stepDays) {
        day = integrate(integrationMethods.RK4, deriv, day, step, initial.stepDays)

        // console.log(getInterventionEffect(step, interventions))
        // console.log(getRt(step, day, initial, eP, interventions, policyRamp))

        // This is where we'll hook this in with
        // the UI from the Finnish team
        const res = {
            day: step,
            exposed: day[0],
            mild: day[1],
            hospitalized: day[2],
            icu: day[3],
            recovered: day[4],
            dead: day[5],
            asymp: day[6],
            r0: getRt(step, [0], initial, eP, interventions, []),
        }

        days.push(
            new UFState(
                initial.population - (res.asymp + res.mild + res.hospitalized + res.icu) - res.recovered - res.dead, // suscep
                // 0, // susceptible 
                // res.asymp + res.mild + res.hospitalized + res.icu, // infected
                res.asymp, // infected
                res.mild,
                res.hospitalized, // hospitalized
                res.icu, // icu
                res.recovered, // recovered 
                res.dead, // fatalities
                res.r0,
            )
        )

    }

    return ({ r0, days })
}

export default talusSEIR
