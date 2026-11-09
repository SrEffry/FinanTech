<?php

namespace App\Modules\Evaluacion\Motor;

/**
 * Textos que ve el cliente sobre su decisión (RF-09, RN-52, D6/UX-03): lenguaje claro, sin
 * códigos, pesos ni puntaje. Hay una entrada por cada variable de CatalogoVariables.
 */
final class CatalogoExplicaciones
{
    public const GENERICO_NEGADA_MOTOR = 'En este momento tu solicitud no cumple las condiciones para aprobarla.';

    public const NEGADA_OFICIAL = 'Un oficial de crédito revisó tu solicitud y decidió no aprobarla en este momento.';

    public const APROBADA = 'Tu solicitud cumple las condiciones para aprobarla.';

    public const APROBADA_CONDICIONADA = 'Tu solicitud se aprobó con condiciones distintas a las que pediste.';

    /** Causal del motor que no es una variable: se explica con la variable que la origina. */
    private const CAUSAL_CUOTA = 'cuota_supera_limite';

    private const TEXTOS = [
        'comportamiento_pago' => [
            'motivo' => 'Registras pagos atrasados recientes con otras entidades.',
            'favorable' => 'Has pagado tus créditos a tiempo.',
            'desfavorable' => 'Tienes pagos atrasados recientes con otras entidades.',
        ],
        'cuota_ingreso' => [
            'motivo' => 'La cuota de este crédito ocuparía una parte muy alta de lo que te queda cada mes.',
            'favorable' => 'La cuota cabe en lo que te queda cada mes.',
            'desfavorable' => 'La cuota ocuparía una parte muy alta de lo que te queda cada mes.',
        ],
        'endeudamiento' => [
            'motivo' => 'Tus deudas con otras entidades son altas frente a tus ingresos.',
            'favorable' => 'Tus deudas con otras entidades son moderadas frente a tus ingresos.',
            'desfavorable' => 'Tus deudas con otras entidades son altas frente a tus ingresos.',
        ],
        'antiguedad_laboral' => [
            'motivo' => 'Llevas poco tiempo en tu actividad actual.',
            'favorable' => 'Llevas un buen tiempo en tu actividad actual.',
            'desfavorable' => 'Llevas poco tiempo en tu actividad actual.',
        ],
        'consultas_recientes' => [
            'motivo' => 'Has pedido varios créditos en poco tiempo.',
            'favorable' => 'No has pedido muchos créditos en los últimos meses.',
            'desfavorable' => 'Has pedido varios créditos en poco tiempo.',
        ],
        'antiguedad_cliente' => [
            'motivo' => 'Todavía llevas poco tiempo con nosotros.',
            'favorable' => 'Ya llevas un tiempo con nosotros.',
            'desfavorable' => 'Todavía llevas poco tiempo con nosotros.',
        ],
    ];

    /** Motivo principal de una negación automática (RF-08 FA-04). */
    public static function motivoDeCausal(?string $causal): string
    {
        $variable = $causal === self::CAUSAL_CUOTA ? 'cuota_ingreso' : $causal;

        return self::TEXTOS[$variable]['motivo'] ?? self::GENERICO_NEGADA_MOTOR;
    }

    /** Explicación de una variable según haya sumado o restado. */
    public static function explicacion(string $variable, bool $favorable): ?string
    {
        return self::TEXTOS[$variable][$favorable ? 'favorable' : 'desfavorable'] ?? null;
    }
}
